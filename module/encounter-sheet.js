export class ExpanseEncounterSheet extends foundry.appv1.sheets.ActorSheet {

  static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["sheet", "actor", "expanse-encounter"],
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

    get actorData() {
        return this.actor.system;
    }
}