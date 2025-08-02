export class ExpanseChallengeSheet extends foundry.appv1.sheets.ActorSheet {

  static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["sheet", "actor", "challenge"],
            width: 730,
            height: 750,
            tabs: [],
            dragDrop: [
                { dragSelector: ".item-list .item", dropSelector: null }
            ]
        });
    }

    // Picks between available/listed templates
    get template() {
        let type = this.actor.type;
        return `systems/expanse/templates/sheet/${type}-sheet.html`;
    }

    async getData() {
        const sheetData = super.getData();
        sheetData.isGM = game.user.isGM;
        sheetData.enrichment = await this._enrichment();
        sheetData.system = sheetData.data.system;

        if (sheetData.system.successThreshold < 1) {
            sheetData.system.successThreshold = 1;
            await this.actor.update({ system: sheetData.system });
        }
        
        //remove unsupported items
        sheetData.unsupported = sheetData.items.filter(i => i.type !== "focus" && i.type !== "consequence");
        for (let [k, v] of Object.entries(sheetData.unsupported)) {
            this.actor.deleteEmbeddedDocuments("Item", [v._id]);
        }
        
        //fetch applicable abilities
        sheetData.focuses = sheetData.items.filter(i => i.type === "focus");
        sheetData.applicableAbilities = [];

        for (let [k, v] of Object.entries(sheetData.focuses)) {
            let ability = {
                id : v._id,
                name : v.system.ability,
                focus : v.name,
                isGM: sheetData.isGM
            };
            sheetData.applicableAbilities.push(ability);
        }

        //fetch consequences
        sheetData.consequences = sheetData.items.filter(i => i.type === "consequence");
        const activeConsequences = sheetData.items.filter(i => i.type === "consequence" && i.system.active == true);
        sheetData.noConsequences = false;
        if (activeConsequences.length == 0) sheetData.noConsequences = true;
        
        //get selected participant
        let selectedParticipantID = "";
        let selectedParticipant = null;
        const flagName = "userParticipantFlag" + this.object.id;

        //participants
        const participants = sheetData.system.participants;
        if (participants.length) {

            const defaultParticipant = participants[0];
            const defaultParticipantID = defaultParticipant.id;
            //get selected participant
            const userParticipantFlag = await game.user.getFlag("expanse", flagName);

            if (!userParticipantFlag) {
                await game.user.setFlag("expanse", flagName, defaultParticipantID);
                selectedParticipant = defaultParticipant;
                console.log("Flag:" + flagName + " has been created.");
            } else {
                selectedParticipantID = userParticipantFlag;
                const selected = participants.filter(i => i.id === selectedParticipantID);
                if (!selected.length) {
                    await game.user.setFlag("expanse", flagName, defaultParticipantID); 
                    selectedParticipant = defaultParticipant;
                } else {
                    selectedParticipant = selected[0];
                }
            }

            for (let pi = 0; pi < participants.length; pi++) {
                const p = participants[pi];
                const pData = p.isToken ? game.actors.tokens[p.id] : game.actors.get(p.id);

                p.name = pData.name;
                p.picture = pData.prototypeToken.texture.src;
                p.speed = pData.system.attributes.speed.modified;
                p.successThreshold = sheetData.system.successThreshold;
                p.selected = (p == selectedParticipant) ? "selected" : "unselected";
                p.isGM = sheetData.isGM;
                p.chaseType = sheetData.system.chaseType;
                p.reveal = (p.visibility == "visible" || sheetData.isGM);
                const sliderPosition = (p.chasePosition / sheetData.system.successThreshold) * 100;
                p.slider = `left: ${sliderPosition}%; background-image: url("${pData.img}");`;

                p.chaseTotal = {};
                const chaseTotal = Math.abs(p.chasePosition - selectedParticipant.chasePosition);
                p.chaseTotal.value = chaseTotal;
                if (p != selectedParticipant) {
                    if (chaseTotal <= sheetData.system.closeRange) {                     
                        p.chaseTotal.indicator = "fa-wifi-weak";
                        p.chaseTotal.title = game.i18n.localize("EXPANSE.CloseRange");
                    };
                    if (chaseTotal > sheetData.system.closeRange && chaseTotal <= sheetData.system.mediumRange) {
                        p.chaseTotal.indicator = "fa-wifi-fair";
                        p.chaseTotal.title = game.i18n.localize("EXPANSE.MediumRange");
                    };
                    if (chaseTotal > sheetData.system.mediumRange) {
                        p.chaseTotal.indicator = "fa-wifi";
                        p.chaseTotal.title = game.i18n.localize("EXPANSE.LongRange");
                    }
                } else p.chaseTotal = "self";
                
            }
            //sort participants by speed
            //participants.sort((a, b) => parseFloat(b.speed) - parseFloat(a.speed));
            //this.actor.update({ system: { participants: participants } });

            const last = participants[participants.length-1];
            participants.map(p => {                
                p.speedModifier = Math.floor((p.speed - last.speed)/2);
            });

            //Progress bar
            if (sheetData.system.type != "chase") {
                sheetData.progress = [];
                for (let i = 0; i < sheetData.system.successThreshold; i++) {
                    if (i < sheetData.system.progress)
                        sheetData.progress[i]=1;
                    else
                        sheetData.progress[i]=0;
                }
            }
        }
        
        return sheetData;
    }

    async _enrichment() {
        let enrichment = {};
        enrichment[`system.description`] = await foundry.applications.ux.TextEditor.enrichHTML(this.actor.system.description, { relativeTo: this.actor });
        enrichment[`system.stunts`] = await foundry.applications.ux.TextEditor.enrichHTML(this.actor.system.stunts, { relativeTo: this.actor });
        return foundry.utils.expandObject(enrichment);
    }

    activateListeners(html) {
        super.activateListeners(html);

        if (!this.options.editable) return;

        // Update Item
        html.find(".item-edit").click((ev) => {
            let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
            const item = this.actor.items.get(itemId);
            item.sheet.render(true);
        });
        
        // Delete Item
        html.find(".item-delete").click((ev) => {
            let li = $(ev.currentTarget).parents(".item"),
                itemId = li.attr("data-item-id");
            this.actor.deleteEmbeddedDocuments("Item", [itemId]);
            li.slideUp(200, () => this.render(false));
        });

        // Create Item
        html.find(".item-create").click(this._itemCreate.bind(this));

        html.find(".participant-delete").click(this._onRemovePassenger.bind(this));
        html.find(".participant-visibility").click(this._onToggleVisibility.bind(this));
        html.find(".chase-mod").click(this._onClickChase.bind(this));
        html.find(".progress-mod").click(this._onClickProgress.bind(this));
        html.find('.chase-position').change(this._onChangeChase.bind(this));
        html.find(".slider-thumb").click(this._onSelectParticipant.bind(this));
        
        html.find(".item-update-checkbox").click((ev) => {
            let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
            let target = $(ev.currentTarget).attr("data-item-checkbox");
            const item = foundry.utils.duplicate(this.actor.getEmbeddedDocument("Item", itemId));
        
            switch (target) {
                    case 'active':
                        item.system.active = !item.system.active;
                        break;
                    case 'resolved':
                        item.system.resolved = !item.system.resolved;
                        break;
                    default:
                        return                    
            };
            this.actor.updateEmbeddedDocuments("Item", [item])
        });
        
    }

    async _onDrop(event) {
        return this.dropChar(event, this.actor) ? null : super._onDrop(event);
    }

    _itemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const type = header.dataset.type;
        const itemData = {
            name: game.i18n.localize(`TYPES.Item.${type}`),
            type: type,
            data: foundry.utils.deepClone(header.dataset)
        };
        delete itemData.data.type;
        return this.actor.createEmbeddedDocuments("Item", [itemData], { renderSheet: true });
    }

    _onRemovePassenger(event) {
        let participantKey = $(event.currentTarget).parents(".item").attr("data-item-key");
        participantKey = Number(participantKey);
        const participants = this.object.system.participants;
        participants.splice(participantKey, 1);

        //handle selected participant for all users
        
        const flagName = "userParticipantFlag" + this.object.id;

        game.users.map(x => {
            if(participants.length == 0) {
                x.unsetFlag("expanse", flagName);
            }         
        });

        this.actor.update({ system: { participants: participants } });
        this.actor.render();
    };
    
    dropChar(event, vehicle) {
        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
        const data = fromUuidSync(dragData.uuid);
        if (data.documentName === "Actor") {
            if (data.type === "character" || data.type === "ship") {
                const passengerData = {
                    id : data.id,
                    isToken : data.isToken,
                    chasePosition: 0,
                    visibility: "not-visible"
                };
                const passengerList = vehicle.system.participants;
                let alreadyOnboard = false;
                passengerList.map( p => {
                    if (p.id === passengerData.id) {
                        alreadyOnboard = true;
                        const parts = {name: p.name, id: p.id};
                        let warning = game.i18n.format("EXPANSE.WARNING.alreadyOnboard", parts);
                        ui.notifications.warn(warning);
                    }
                });

                if (!alreadyOnboard) {
                    passengerList.push(passengerData);
                    vehicle.update({"system.participants" : passengerList});
                }
            } else {
                const warning = game.i18n.localize("EXPANSE.WARNING.ThisIsNotValidParticipant");
                ui.notifications.warn(warning);
            }
        } else return false;
        return true;
    }

    async _onClickChase(event){
        event.preventDefault();
        const participants = foundry.utils.duplicate(this.actor.system.participants);
        let successThreshold = Number(this.actor.system.successThreshold);
        let participantKey = $(event.currentTarget).parents(".item").attr("data-item-key");
        participantKey = Number(participantKey);
        (event.currentTarget.classList.contains('minus')) ? participants[participantKey].chasePosition-- : participants[participantKey].chasePosition++;
        
        if(participants[participantKey].chasePosition < 0) participants[participantKey].chasePosition = 0;
        
        if (this.actor.system.chaseType == "successThreshold"){
            if(participants[participantKey].chasePosition > successThreshold) participants[participantKey].chasePosition = successThreshold;
        } else {
            if(participants[participantKey].chasePosition > (successThreshold - 1)) successThreshold = participants[participantKey].chasePosition + 1;
            await this.actor.update({ "system.successThreshold": successThreshold });
        }

        await this.actor.update({ system: { participants: participants } });
    }

    async _onClickProgress(event){
        event.preventDefault();
        let progress = this.actor.system.progress;

        (event.currentTarget.classList.contains('minus')) ? progress-- : progress++;
        if(progress < 0) progress = 0;
        if(progress > this.actor.system.successThreshold) progress = this.actor.system.successThreshold;

        await this.actor.update({ system: { progress: progress } });
    }

    async _onChangeChase(event){
        event.preventDefault();
        const value = event.currentTarget.value;
        const participants = foundry.utils.duplicate(this.actor.system.participants);
        let participantKey = $(event.currentTarget).parents(".item").attr("data-item-key");
        participantKey = Number(participantKey);

        participants[participantKey].chasePosition = value;    

        await this.actor.update({ system: { participants: participants } });
    }

    async _onSelectParticipant(event) {
        event.preventDefault();
        let participantKey = $(event.currentTarget).parents(".item").attr ("data-item-key");
        participantKey = Number(participantKey);

        const participants = this.actor.system.participants;
        const id = participants[participantKey].id; 

        if (!event.shiftKey) {
            const flagName = "userParticipantFlag" + this.object.id;
            await game.user.setFlag("expanse", flagName, id);
            this.actor.render();
        } else if(event.shiftKey){
            const actor = Actor.get(id);
            actor.sheet.render(true);
        }
    }

    _onToggleVisibility(event){
        let participantKey = $(event.currentTarget).parents(".item").attr("data-item-key");
        participantKey = Number(participantKey);
        const participants = this.object.system.participants;

        if (participants[participantKey].visibility == "visible"){
            participants[participantKey].visibility = "not-visible";
        } else {
            participants[participantKey].visibility = "visible";    
        }

        this.actor.update({ system: { participants: participants } });
        this.actor.render();    
    }
}