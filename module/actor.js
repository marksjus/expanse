/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */

export class ExpanseActor extends Actor {
  /** @override */

  prepareData() {
    super.prepareData();
  }

  _preCreate(data) {
    const path = "systems/expanse/ui/item-img/"
    if (data.type === "ship") {
      this.updateSource({ img: `${path}actor-ship.png` })
    }

    let createData = {};

    if (!data.token) {
      foundry.utils.mergeObject(createData,
        {
          "token.bar1": { "attribute": "attributes.fortune" },                       // Default Bar 1 to Fortune
          "token.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,    // Default display name to be on owner hover
          "token.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,    // Default display bars to be on owner hover
          "token.disposition": CONST.TOKEN_DISPOSITIONS.NEUTRAL,         // Default disposition to neutral
          "token.name": data.name                                       // Set token name to actor name
        }
      )
    } else if (data.token) {
      createData.token = data.token
    }

    if (data.type == "character") {
      createData.token.vision = true;
      createData.token.actorLink = true;
    }

    this.updateSource(createData);
  }

  prepareEmbeddedEntities() {
  }


  prepareData() {
    const actorData = this.system;

    if (this.type === "character") {
      actorData.attributes.armor.modified = 0;
      actorData.attributes.penalty.modified = 0;
      actorData.attributes.defense.bonus = 0;

      for (let item of this.items) {
        if (item.type === "armor" && item.system.equip === true) {
          actorData.attributes.armor.modified = Number(item.system.bonus);
          actorData.attributes.penalty.modified = Number(item.system.penalty);
        }
        //shields
        if (item.type === "shield" && item.system.equip === true) {
          actorData.attributes.defense.bonus = Number(item.system.bonus);
        }
      }

      actorData.attributes.speed.modified = 10 + Number(actorData.abilities.dexterity.rating) - Number(actorData.attributes.penalty.modified);
      actorData.attributes.defense.modified = 10 + Number(actorData.abilities.dexterity.rating) + Number(actorData.attributes.defense.bonus);
      actorData.attributes.toughness.modified = Number(actorData.abilities.constitution.rating);
      actorData.attributes.move.modified = Number(actorData.attributes.speed.modified);
      actorData.attributes.run.modified = Number(actorData.attributes.speed.modified * 2)

      if (actorData.attributes.level.modified >= 11) {
        actorData.attributes.level.bonus = true;
      }

      if (actorData.conditions.injured.active === true) {
        actorData.conditions.fatigued.active = true;
      }
      if (actorData.conditions.hindered.active === true) {
        actorData.attributes.move.modified = actorData.attributes.move.modified / 2;
        actorData.attributes.run.modified = 0;
      }
      if (actorData.conditions.exhausted.active === true || actorData.conditions.prone.active === true || actorData.conditions.fatigued.active === true) {
        actorData.attributes.run.modified = 0;
      }
      if (actorData.conditions.helpless.active === true || actorData.conditions.restrained.active === true) {
        actorData.attributes.run.modified = 0;
        actorData.attributes.move.modified = 0;
      }
      if (actorData.conditions.unconscious.active === true) {
        actorData.conditions.prone.active = true;
        actorData.attributes.move.modified = 0;
        actorData.attributes.run.modified = 0;
      }
    }
    super.prepareData();

  }

  /* -------------------------------------------- */
  /*  Data Migration                              */
  /* -------------------------------------------- */

  /** @override */
  static migrateData(source) {
    const systemData = source.system
    
 
        // 2.0.0 -> 3.0.0
        if (typeof(systemData.crew) === "string") {
          console.log(this.actor)
          console.log(`Begin migration of ${source.name} (id: ${source._id}) data.`);
          // Move crew to crewCount
          systemData["crewCount"] = Number(systemData.crew);
          delete systemData.crew;

          // Move crewX to crew.crewX
          //Replace stat with ability string and add buttonTitle
          const ability = {
            "captain" : `${game.i18n.localize("EXPANSE.Communication")} (${game.i18n.localize("EXPANSE.Leadership")})`,
            "pilot" : `${game.i18n.localize("EXPANSE.Dexterity")} (${game.i18n.localize("EXPANSE.Piloting")})`,
            "sensors" : `${game.i18n.localize("EXPANSE.Intelligence")} (${game.i18n.localize("EXPANSE.Technology")})`,
            "gunnary" : `${game.i18n.localize("EXPANSE.Accuracy")} (${game.i18n.localize("EXPANSE.Gunnery")})`,
            "engineer" : `${game.i18n.localize("EXPANSE.Intelligence")} (${game.i18n.localize("EXPANSE.Engineering")})`,
            "other" : ""
          };   
        
          const buttonTitle = {
            "captain" : game.i18n.localize("EXPANSE.CrewCommandTest"),
            "pilot" : game.i18n.localize("EXPANSE.CrewPilotTest"),
            "sensors" : game.i18n.localize("EXPANSE.CrewElectronicWarfareTest"),
            "gunnary" : game.i18n.localize("EXPANSE.CrewGunnaryTest"),
            "engineer" : game.i18n.localize("EXPANSE.CrewDamageControlTest"),
            "other" : ""
          };     

          let crewData = {};
          let crew = {
            "role": "",
            "stat": "",
            "modValue": 0,
            "focus": false,
            "buttonTitle": "",
            "name": ""      
          };

          for(let i=1;i<=6;i++){
            const tmp = Object.create(crew);
            
            const oldCrew = systemData["crew"+i];
            tmp.role = oldCrew.role;
            tmp.stat = ability[oldCrew.role];
            tmp.modValue = oldCrew.modValue;
            tmp.focus = false;
            tmp.buttonTitle = buttonTitle[oldCrew.role];
            tmp.name = oldCrew.name;

            crewData["crew"+i] = tmp;
            delete systemData["crew"+i];
          };

          systemData["crew"] = crewData;

          //Move weaponX to weaponX.description
          let weapon = {
            "type": "",
            "description": "",
            "damage": ""     
          };

          for(let i=1;i<=4;i++){
            const tmp = Object.create(weapon);     
            const oldWeapon = systemData["weapon"+i];
            tmp.type = "";
            tmp.description = oldWeapon;
            tmp.damage = "";
            delete systemData["weapon"+i];
            systemData["weapon"+i] = tmp;
          };

          //Change sensors type to number
          const pattern = new RegExp("[0-9]+", "g");
          if(systemData.sensors.match(pattern)) {
            systemData.sensors = Number(systemData.sensors);
          } else {
            systemData.sensors = 0;
          }
          console.log(`Finished migration of ${source.name} (id: ${source._id}) data.`);
        }
        // 3.0.0 -> 3.0.1
        const reactoroffline = systemData?.seriouslosses?.reactoroffline
        if(typeof(reactoroffline?.value) === "boolean"){
          reactoroffline.value = reactoroffline.value ? 1 : 0
        }
        
        const weaponoffline = systemData?.seriouslosses?.weaponoffline
        if(typeof(weaponoffline?.value) === "boolean"){
          weaponoffline.value = weaponoffline.value ? 1 : 0
        }

    return super.migrateData(source);
  }
}
