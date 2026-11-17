// OZATROOM BIM · Coordinate System v1
export const WORLD_AXES=Object.freeze({X:'horizontal',Y:'depth',Z:'vertical'});
export const WORLD_ORIGIN=Object.freeze({x:0,y:0,z:0});
export const UNIT_TO_METRES=Object.freeze({m:1,cm:.01,mm:.001});
export class CoordinateSystem{
 constructor({storageUnit='m',displayUnit='m',tolerance=1e-7}={}){if(!(storageUnit in UNIT_TO_METRES)||!(displayUnit in UNIT_TO_METRES))throw new RangeError('Unsupported project unit');if(!Number.isFinite(tolerance)||tolerance<=0)throw new RangeError('Tolerance must be positive');this.storageUnit=storageUnit;this.displayUnit=displayUnit;this.tolerance=tolerance}
 toMetres(value,unit=this.displayUnit){if(!Number.isFinite(value)||!(unit in UNIT_TO_METRES))throw new TypeError('Invalid value or unit');return value*UNIT_TO_METRES[unit]}
 fromMetres(value,unit=this.displayUnit){if(!Number.isFinite(value)||!(unit in UNIT_TO_METRES))throw new TypeError('Invalid value or unit');return value/UNIT_TO_METRES[unit]}
 display(value){return this.fromMetres(value,this.displayUnit)}
 setDisplayUnit(unit){if(!(unit in UNIT_TO_METRES))throw new RangeError('Unsupported display unit');this.displayUnit=unit;return this}
 setTolerance(value){if(!Number.isFinite(value)||value<=0)throw new RangeError('Tolerance must be positive');this.tolerance=value;return this}
 serialize(){return {storageUnit:this.storageUnit,displayUnit:this.displayUnit,tolerance:this.tolerance,axes:WORLD_AXES,origin:WORLD_ORIGIN}}
}
