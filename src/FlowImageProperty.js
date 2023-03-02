import createPropertyDescriptor from "../node_modules/@cesium/engine/Source/DataSources/createPropertyDescriptor";
import Property from "../node_modules/@cesium/engine/Source/DataSources/Property";
import Cartesian2 from "../node_modules/@cesium/engine/Source/Core/Cartesian2";
import Color from "../node_modules/@cesium/engine/Source/Core/Color";
// import defaultValue from "../node_modules/@cesium/engine/Source/Core/defaultValue";
import defined from "../node_modules/@cesium/engine/Source/Core/defined";
import Event from "../node_modules/@cesium/engine/Source/Core/Event";
import * as Cesium from "cesium";

// 初始化属性
function FlowImageProperty(options) {
	// options = defaultValue(options, defaultValue.EMPTY_OBJECT);
	this._definitionChanged = new Event();
	this._image = undefined;
	this._imageSubscription = undefined;
	this._repeat = undefined;
	this._repeatSubscription = undefined;
	this._color = undefined;
	this._colorSubscription = undefined;
	this._duration = undefined;
	this._durationSubscription = undefined;
	this._flowAxis = undefined;
	this._flowAxisSubscription = undefined;
	this._transparent = undefined;
	this._transparentSubscription = undefined;

	this.image = options.image;
	this.repeat = options.repeat;
	this.duration = options.duration;
	// 默认沿x轴方向进行流动
	this.flowAxis = options.flowAxis ? options.flowAxis : "x";
	this.color = options.color;
	this.transparent = options.transparent;
}

//定义属性代理
Object.defineProperties(FlowImageProperty.prototype, {
	isConstant: {
		get: function () {
			return false;
		},
	},
	definitionChanged: {
		get: function () {
			return this._definitionChanged;
		},
	},
	image: createPropertyDescriptor("image"),
	repeat: createPropertyDescriptor("repeat"),
	duration: createPropertyDescriptor("duration"),
	flowAxis: createPropertyDescriptor("flowAxis"),
	color: createPropertyDescriptor("color"),
	transparent: createPropertyDescriptor("transparent"),
});

FlowImageProperty.prototype.getType = function (time) {
	return "FlowImage";
};

FlowImageProperty.prototype.getValue = function (time, result) {
	if (!defined(result)) {
		result = {};
	}
	result.image = "https://c-ssl.dtstatic.com/uploads/item/201410/08/20141008205803_ua2md.thumb.1000_0.jpeg",
	result.repeat = Property.getValueOrClonedDefault(
		this._repeat,
		time,
		new Cartesian2(1, 1),
		result.repeat
	);
	result.flowAxis = this._flowAxis;
	result.duration = this._duration;
	result.dt = (Date.now() / 1000) % result.duration;
	result.color = Property.getValueOrClonedDefault(
		this._color,
		time,
		Color.WHITE,
		result.color
	);
	result.color.alpha = 1.0;

	return result;
};

FlowImageProperty.prototype.equals = function (other) {
	return (
		this === other ||
		(other instanceof ImageMaterialProperty &&
			Property.equals(this._image, other._image) &&
			Property.equals(this._repeat, other._repeat) &&
			Property.equals(this._duration, other._duration) &&
			Property.equals(this._flowAxis, other._flowAxis) &&
			Property.equals(this._color, other._color) &&
			Property.equals(this._transparent, other._transparent))
	);
};

// 将改材质添加到cesium材质缓存中
const shaderSource = `
            czm_material czm_getMaterial(czm_materialInput materialInput)
            {
                czm_material m = czm_getDefaultMaterial(materialInput);
                float x = texture2D(image, vec2(0.5,0.5));
				m.diffuse = 
				m.alpha = dt / duration;
                return m;
            }
        `;
Cesium.Material.FlowImageMaterialType = "FlowImage";
Cesium.Material._materialCache.addMaterial(
	Cesium.Material.FlowImageMaterialType,
	{
		fabric: {
			type: Cesium.Material.FlowImageMaterialType,
			uniforms: {
				image: Cesium.Material.DefaultImageId,
				repeat: new Cesium.Cartesian2(1, 1),
				flowAxis: "x",
				duration: 10,
				dt: 0,
				color: Cesium.Color.WHITE,
			},
			source: shaderSource,
		},
		translucent: function (material) {
			return true;
		},
	}
);
export default FlowImageProperty;
