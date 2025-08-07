
Hooks.on("createActiveEffect", function(document){
    const parent = document.parent;

    const challenges = game.actors.filter(i => i.type === "challenge");
      challenges.map(x => {
        const participants = x.system.participants;
        for (let pi = 0; pi < participants.length; pi++) {
          if (participants[pi].id == parent.id) {
            participants[pi].toggleForceUpdate = !participants[pi].toggleForceUpdate;
            break;
          };
        };
        x.update({ system: { participants: participants } });
      });
});

Hooks.on("deleteActiveEffect", function(document){
    const parent = document.parent;

    const challenges = game.actors.filter(i => i.type === "challenge");
      challenges.map(x => {
        const participants = x.system.participants;
        for (let pi = 0; pi < participants.length; pi++) {
          if (participants[pi].id == parent.id) {
            participants[pi].toggleForceUpdate = !participants[pi].toggleForceUpdate;
            break;
          };
        };
        x.update({ system: { participants: participants } });
      });
});

function hasEffectApplied (actor, name) {

  const effects = actor.effects;

  let hasEffectApplied = false;
  effects.map(x => {
    if (x.name == name) {
      hasEffectApplied = true;
    }
  });

  return hasEffectApplied
}

// Make all effects unique 
Hooks.on("preCreateActiveEffect", function(document, data, options, userId) {

  const name = document.name;
  const actor = document.parent;

  if (hasEffectApplied(actor, name))
    return false;

  return true
});

//Prevent dependant effect removal.
Hooks.on("preDeleteActiveEffect", function(document, data, options, userId) {

  const name = document.name;
  const actor = document.parent;
  let param = {name: name, inhibitor: ""};

  switch (name) {
    case "PRONE":
        if (hasEffectApplied(actor, "UNCONSCIOUS")) {
            param.inhibitor = "UNCONSCIOUS"
            const warning = game.i18n.format("EXPANSE.WARNING.CannotRemoveEffect", param);
            ui.notifications.warn(warning);
            return false;
        }    
        break;

    case "HELPLESS":
        if (hasEffectApplied(actor, "UNCONSCIOUS")) {
            param.inhibitor = "UNCONSCIOUS"
            const warning = game.i18n.format("EXPANSE.WARNING.CannotRemoveEffect", param);
            ui.notifications.warn(warning);
            return false;
        }    
        break;

    case "FATIGUED":
        if (hasEffectApplied(actor, "INJURED")) {
            param.inhibitor = "INJURED"
            const warning = game.i18n.format("EXPANSE.WARNING.CannotRemoveEffect", param);
            ui.notifications.warn(warning);
            return false;
        }    
        break;
  
    default:
        break;
  }

  return true
});

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

        const path = "systems/expanse/ui/item-img/";
        console.log(this.actor.img);
        if( (this.actor.img == `${path}chase.png`) || 
            (this.actor.img == `${path}exploration.png`) ||
            (this.actor.img == `${path}social.png`) ||
            (this.actor.img == `${path}vehicleChase.png`)){

            switch (sheetData.system.type) {
                case "chase":
                    this.actor.img = `${path}chase.png`
                    break;
                case "exploration":
                    this.actor.img = `${path}exploration.png`
                    break;
                case "social":
                    this.actor.img = `${path}social.png`
                    break;
                case "vehicleChase":
                    this.actor.img = `${path}vehicleChase.png`
                    break;
            
                default:
                    break;
            }
        }

        if (sheetData.system.type == "chase" || sheetData.system.type == "vehicleChase")
            sheetData.chase = true;
        else
            sheetData.chase = false;
        
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
                p.isGM = sheetData.isGM;
                p.successThreshold = sheetData.system.successThreshold;
                p.reveal = (p.visibility == "visible" || sheetData.isGM);
                
                if (sheetData.chase) {
                    if (sheetData.system.type === "chase")
                        p.speed = pData.system.attributes.speed.modified;
                    else
                        p.speed = this.shipSpeed(pData.system.type);

                    p.selected = (p == selectedParticipant) ? "selected" : "unselected";                
                    p.chaseType = sheetData.system.chaseType;
                    const sliderPosition = (p.chasePosition / sheetData.system.successThreshold) * 100;
                    p.slider = `left: ${sliderPosition}%; background-image: url("${p.picture}");`;

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

                //Effects
                p.effects = [];
                pData.effects.map(e => {
                    const effect = {
                        id: e.id,
                        name: e.name,
                        img: e.img,
                        description: e.description,
                        rounds: "",
                        turns: "",
                        unlimited: "",
                        isTemporary: e.isTemporary,
                        expired: ""
                    };

                    const expired = this.isEffectExpired(e);
                    effect.expired = expired ? "not-visible" : "visible";

                    const rounds = e.duration.rounds;
                    const turns = e.duration.turns;
                    if(!expired) {
                        
                        if (rounds > 0) {
                            let duration = "";
                            if (rounds == 1) duration = game.i18n.format("EXPANSE.Round", {value :rounds});
                            if (rounds > 1) duration = game.i18n.format("EXPANSE.RoundsLessFive", {value :rounds});
                            if (rounds >= 5) duration = game.i18n.format("EXPANSE.Rounds", {value :rounds});
                            effect.rounds = duration;
                        };

                        if (turns > 0) {
                            let duration = "";
                            if (turns == 1) duration = game.i18n.format("EXPANSE.Turn", {value :turns});
                            if (turns > 1) duration = game.i18n.format("EXPANSE.TurnsLessFive", {value :turns});
                            if (turns >= 5) duration = game.i18n.format("EXPANSE.Turns", {value :turns});
                            effect.turns = duration;
                        };
                    }

                    if (!rounds && !turns) {
                        effect.unlimited = game.i18n.localize("EXPANSE.Unlimited");
                    };

                    p.effects.push(effect);
                });
          
            }
            //sort participants by speed
            //participants.sort((a, b) => parseFloat(b.speed) - parseFloat(a.speed));
            //this.actor.update({ system: { participants: participants } });
            if (sheetData.chase) {
                const slowestSpeed = this.getSlowestParticipant(participants).speed;
                participants.map(p => {   
                    if (sheetData.system.type == "chase")            
                        p.speedModifier = Math.floor((p.speed - slowestSpeed)/2);
                    else
                        p.speedModifier = p.speed - slowestSpeed;
                });
            }
        }

        //Progress bar
        if (sheetData.system.type != "chase") {
            sheetData.progress = [];
            for (let i = 0; i < sheetData.system.successThreshold; i++) {
                if (i < sheetData.system.progress)
                    sheetData.progress[i] = 1;
                else
                    sheetData.progress[i] = 0;
            }
        }
        
        return sheetData;
    }

    getSlowestParticipant(participants){
        return participants.reduce(function(prev, curr) {
            return prev.speed < curr.speed ? prev : curr;
        });
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
            const itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
            this.actor.deleteEmbeddedDocuments("Item", [itemId]);
        });

        // Create Item
        html.find(".item-create").click(this._itemCreate.bind(this));

        html.find(".participant-delete").click(this._onRemovePassenger.bind(this));
        html.find(".participant-visibility").click(this._onToggleVisibility.bind(this));
        html.find(".chase-mod").click(this._onClickChase.bind(this));
        html.find(".progress-mod").click(this._onClickProgress.bind(this));
        html.find('.attitude-selector').change(this._onChangeAttitude.bind(this));
        html.find('.challenge-type-selector').change(this._onChangeType.bind(this));
        html.find(".chase-reset").click(this._onResetChase.bind(this));
        html.find(".slider-thumb").click(this._onSelectParticipant.bind(this));
        html.find(".picture").click(this._onClickParticipant.bind(this));

        html.find(".effect-img").contextmenu(this._onClickEffect.bind(this));
        
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
    };
    
    dropChar(event, vehicle) {
        const dragData = JSON.parse(event.dataTransfer.getData("text/plain"))
        const data = fromUuidSync(dragData.uuid);
        if (data.documentName === "Actor") {
            if (data.type !== "challenge") {
                const passengerData = {
                    id : data.id,
                    isToken : data.isToken,
                    chasePosition: 0,
                    visibility: "not-visible",
                    attitude: "Neutral",
                    toggleForceUpdate: false,
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
                    const cType = this.actor.system.type;

                    if (((data.type === "character" || data.type === "npc") && cType !== "vehicleChase") ||
                        (data.type === "ship" && cType === "vehicleChase") ) {

                        passengerList.push(passengerData);
                        vehicle.update({"system.participants" : passengerList});
                    }
                    else {
                        const warning = game.i18n.localize("EXPANSE.WARNING.ThisIsNotValidParticipant");
                        ui.notifications.warn(warning);
                    }    
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

    async _onClickEffect(event){

        if(game.user.isActiveGM) {
            const effectID = $(event.currentTarget).attr("data-item-id");

            const participants = foundry.utils.duplicate(this.actor.system.participants);
            let participantKey = $(event.currentTarget).parents(".item").attr("data-item-key");
            participantKey = Number(participantKey);
            const p = participants[participantKey];
            const pData = p.isToken ? game.actors.tokens[p.id] : game.actors.get(p.id);

            p.toggleForceUpdate = !p.toggleForceUpdate;
            await pData.deleteEmbeddedDocuments("ActiveEffect", [effectID]);
            await this.actor.update({ system: { participants: participants } });
        }
    }

    async _onChangeAttitude(event){
        event.preventDefault();
        const value = event.currentTarget.value;
        const participants = foundry.utils.duplicate(this.actor.system.participants);
        let participantKey = $(event.currentTarget).parents(".item").attr("data-item-key");
        participantKey = Number(participantKey);

        participants[participantKey].attitude = value;    
        
        await this.actor.update({ system: { participants: participants } });
    }

    async _onChangeType(event){
        const systemData = foundry.utils.duplicate(this.actor.system);
        systemData.type = event.currentTarget.value;
        systemData.participants = this.validateParticipants(systemData);   
        
        await this.actor.update({ system: systemData });
    }

    async _onResetChase(event){
        event.preventDefault();
        const systemData = foundry.utils.duplicate(this.actor.system);

        if (systemData.type == "chase" || systemData.type == "vehicleChase") {
            if(systemData.chaseType == "chaseTotal")
                systemData.successThreshold = systemData.chaseTotal;

            const participants = systemData.participants;

            for (let pi = 0; pi < participants.length; pi++) {
                participants[pi].chasePosition = 0;
            }
        } else {
            systemData.progress = 0;
        }
        await this.actor.update({ system: systemData });
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

    async _onClickParticipant(event){
        event.preventDefault();
        let participantKey = $(event.currentTarget).parents(".item").attr ("data-item-key");
        participantKey = Number(participantKey);

        const participants = this.actor.system.participants;
        const id = participants[participantKey].id; 
        
        const actor = Actor.get(id);
        actor.sheet.render(true);   
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
    }

    getRoundsRemaining(duration){
        if (duration.rounds === null) return null;

        const currentRound = game.combat?.round ?? 0;
        const endingRound = (duration.startRound || 0) + duration.rounds;

        return endingRound - currentRound;
    }

    getTurnsRemaining(duration){
        if (duration.turns === null) return null;

        const currentTurn = game.combat?.turn ?? 0;
        const endingTurn = (duration.startTurn || 0) + duration.turns;

        return endingTurn - currentTurn;
    }

    isEffectExpired(effect){
        const durationType = effect.duration.type;

        if (durationType === "turns") {
            const remainingRounds =
                this.getRoundsRemaining(effect.duration) ?? 0;
            const remainingTurns =
                this.getTurnsRemaining(effect.duration) ?? 0;
            return (
                remainingRounds < 0 ||
                (remainingRounds === 0 && remainingTurns <= 0)
            );
        }

        return false;
    }

    validateParticipants(data) {
        console.log(data);
        const participants = data.participants;
        let invalidParticipants = [];
        for (let pi = 0; pi < participants.length; pi++) {
            const p = participants[pi];
            if (!game.actors) {
                game.postReadyPrepare.push(this);
            } else {
                const pData = p.isToken ? game.actors.tokens[p.id] : game.actors.get(p.id);
                if (!pData) {
                    invalidParticipants.push(pi);
                }
                if (data.type === "vehicleChase"){
                    if (pData.type !== "ship")
                       invalidParticipants.push(pi); 
                } else {

                    if (pData.type === "ship")
                        invalidParticipants.push(pi);                   
                }           
            }
        }
        // Remove passengers whose sheets/tokens are not valid anymore
        for (let i = invalidParticipants.length -1; i >= 0; i--)
            participants.splice(invalidParticipants[i],1);

        return participants;

    };

    shipSpeed(size){
        let speed = 0;
        switch (size) {
            case "Torpedo":
                speed = 9;
                break;

            case "Tiny":
                speed = 7;
                break;

            case "Small":
                speed = 6;
                break;

            case "Medium":
                speed = 5;
                break;

            case "Large":
                speed = 4;
                break;

            case "Huge":
                speed = 3;
                break;

            case "Gigantic":
                speed = 2;
                break;

            case "Colossal":
                speed = 1;
                break;

            case "Titanic":
                speed = 0;
                break;
        
            default:
                speed = 0;
                break;
        }
        return speed;
    }
}