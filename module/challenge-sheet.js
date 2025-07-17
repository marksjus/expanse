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

        //remove unsupported items
        sheetData.unsupported = sheetData.items.filter(i => i.type !== "focus");
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

        console.log(sheetData.unsupported);
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
}