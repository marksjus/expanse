export async function migrateNpcData(actor) {

  
  const flagValue = actor.getFlag('expanse', 'valueToModifiedMigrationDone');
  if(!flagValue) {
    let attributes = actor.system.attributes

    for (let [key, attribute] of Object.entries(attributes)) {
      attribute.modified = attribute.value;
      attribute.value = 0;
    }; 

    actor.valueToModifiedMigration = true;
    await actor.update({ system: { attributes: attributes } });
    await actor.setFlag('expanse', 'valueToModifiedMigrationDone', true);
    console.log(`Finished migration of ${actor.name} data.`);
  }
  
  return actor;

}