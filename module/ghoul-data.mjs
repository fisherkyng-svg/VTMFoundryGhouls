// Ghoul / revenant actor data (fork addition).
// Reuses the vampire schema (blood, virtues, path, disciplines live as items) and adds
// ghoul-specific fields. No generation table: blood pool max is set by hand, one blood
// point per turn, traits cap at 5.
import { VampireData } from './vampire-data.mjs';

const f = foundry.data.fields;
const str = (initial = '') => new f.StringField({ required: true, nullable: false, initial });

export class GhoulData extends VampireData {
  static defineSchema() {
    const schema = super.defineSchema();
    // Living humans start with Appearance 1 (the vampire schema starts at 0 for Nosferatu)
    schema.attributes.fields.appearance.initial = 1;
    schema.variety = new f.StringField({ required: true, nullable: false, initial: 'ghoul', choices: ['ghoul', 'revenant'] });
    schema.family = str();   // revenant family (Bratovich, Grimaldi, Obertus, Zantosa, ...)
    schema.domitor = str();  // regnant / domitor
    return schema;
  }

  prepareDerivedData() {
    const storedMax = this.blood.max;
    super.prepareDerivedData();          // health, wound penalties, movement (generation table skipped below)
    this.blood.max = storedMax;          // undo any generation-table override
    if (this.blood.value > this.blood.max) this.blood.value = this.blood.max;
    this.bloodPerTurn = 1;
    this.traitMax = 5;
  }
}
