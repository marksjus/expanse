export class ExpanseChallengeSheet extends foundry.appv1.sheets.ActorSheet {

  static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["sheet", "actor", "expanse-challenge"],
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
                focus : v.name
            };
            sheetData.applicableAbilities.push(ability);
        }

        //fetch consequences
        sheetData.consequences = sheetData.items.filter(i => i.type === "consequence");
        sheetData.ActiveConsequences = sheetData.items.filter(i => i.type === "consequence" && i.system.active == true);

        //get selected participant
        let selectedParticipant = 0;
        const flagName = "userParticipantFlag" + this.id;
        const userParticipantFlag = await game.user.getFlag("expanse", flagName);
        if (!userParticipantFlag) await game.user.setFlag("expanse", flagName, selectedParticipant); else selectedParticipant = userParticipantFlag;

        console.log(userParticipantFlag);


        //participants
        const passengers = sheetData.system.participants;
        let invalidPassengers = [];
        for (let pi = 0; pi < passengers.length; pi++) {
            const p = passengers[pi];
            if (!game.actors) {
                game.postReadyPrepare.push(this);
            } else {
                const pData = p.isToken ? game.actors.tokens[p.id] : game.actors.get(p.id);
                if (!pData) {
                    invalidPassengers.push(pi);
                } else {
                    p.name = pData.name;
                    p.picture = pData.prototypeToken.texture.src;
                    p.speed = pData.system.attributes.speed.modified;
                    p.successThreshold = sheetData.system.successThreshold;
                    p.selected = (pi == selectedParticipant) ? true : false;
                    
                    const chaseTotal = Math.abs(p.chasePosition - passengers[selectedParticipant].chasePosition);
                    if (pi != selectedParticipant) {
                        if (chaseTotal <= sheetData.system.closeRange) p.chaseTotal = "closeRange (" + chaseTotal + ")";
                        if (chaseTotal > sheetData.system.closeRange && chaseTotal <= sheetData.system.mediumRange ) p.chaseTotal = "mediumRange (" + chaseTotal + ")";
                        if (chaseTotal > sheetData.system.mediumRange ) p.chaseTotal = "longRange (" + chaseTotal + ")";
                    } else p.chaseTotal = "-";
                };
            }
        }
        // Remove participants whose sheets/tokens are not valid anymore
        for (let ip = 0; ip < invalidPassengers.length; ip++) {
            const i = invalidPassengers[ip];
            passengers.splice(i, 1);
        };

        //sort participants by speed
        passengers.sort((a, b) => parseFloat(b.speed) - parseFloat(a.speed));

        console.log(passengers);
        
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
        html.find(".chase-mod").click(this._onClickChase.bind(this));
        html.find('.chase-position').change(this._onChangeChase.bind(this));
        html.find(".selected-participant").click(this._onSelectParticipant.bind(this));
        
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
        let update = {};
        let participantKey = $(event.currentTarget).parents(".item").attr("data-item-key");
        participantKey = Number(participantKey);
        const crew = this.object.system.participants;
        crew.splice(participantKey, 1);
        this.actor.update({...update, "system.participants": crew});
    };
    
    dropChar(event, vehicle) {
        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
        const data = fromUuidSync(dragData.uuid);
        if (data.documentName === "Actor") {
            if (data.type === "character" || data.type === "ship") {
                const passengerData = {
                    id : data.id,
                    isToken : data.isToken,
                    chasePosition: 0
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
        let participantKey = $(event.currentTarget).parents(".item").attr("data-item-key");
        participantKey = Number(participantKey);
        console.log(participantKey);
        (event.currentTarget.classList.contains('minus')) ? participants[participantKey].chasePosition-- : participants[participantKey].chasePosition++;
        if(participants[participantKey].chasePosition < 0) participants[participantKey].chasePosition = 0;
        if(participants[participantKey].chasePosition > this.actor.system.successThreshold) participants[participantKey].chasePosition = this.actor.system.successThreshold;

        await this.actor.update({ system: { participants: participants } });
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

        const flagName = "userParticipantFlag" + this.id;
        await game.user.setFlag("expanse", flagName, participantKey);
        this.actor.render();
        console.log(participantKey);
    }
}