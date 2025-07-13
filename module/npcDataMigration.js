export async function migrateNpcData(actor) {

  let systemData = actor.system;
  
  if(typeof actor?.valueToModifiedMigration == 'undefined') {

    let attributes = systemData.attributes

    for (let [key, attribute] of Object.entries(attributes)) {
      attribute.modified = attribute.value;
      attribute.value = 0;
    }; 

    actor.valueToModifiedMigration = true;
    await actor.update({ system: { attributes: attributes } });
    console.log(`Finished migration of ${actor.name} data.`);
  }
  
  return actor;

}