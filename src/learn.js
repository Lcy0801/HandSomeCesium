import {
	Material,
	Property,
	createPropertyDescriptor,
	Color,
	WebMercatorTilingScheme,
	Cartesian3,
	Cartesian2,
	Rectangle,
	Credit,
	defineProperties,
	isArray,
	GeographicProjection,
	Cartographic,
	combine,
	Event,
	DeveloperError,
	defined,
	when,
	Resource,
	defaultValue,
	ImageryProvider,
} from "cesium";
const defaultRepeat = new Cartesian2(1, 1),
	changeRepeat = new Cartesian2(1, 1),
	defaultTransparent = !1,
	defaultColor = Color.WHITE,
	defaultDuration = 5e3,
	defaultShiness = 0,
	defaultFlowAxisY = !1;
function PolylineFlowImgMaterialProperty(e) {
	(this._scene = e.scene),
		(this._meterLength = e.meterLength),
		(this._definitionChanged = new Event()),
		(this._image = void 0),
		(this._imageSubscription = void 0),
		(this._repeat = void 0),
		(this._repeatSubscription = void 0),
		(this._color = void 0),
		(this._colorSubscription = void 0),
		(this._transparent = void 0),
		(this._transparentSubscription = void 0),
		(this.image = e.image),
		(this.repeat = e.repeat || defaultRepeat),
		(this.color = e.color || defaultColor),
		(this.transparent = e.transparent || defaultTransparent),
		(this.shiness = defaultShiness),
		void 0 !== e.shiness && (this.shiness = e.shiness),
		(this._time = new Date().getTime()),
		(this.duration = e.duration || defaultDuration),
		(this.flowAxisY = e.flowAxisY || defaultFlowAxisY);
}
Object.defineProperties(PolylineFlowImgMaterialProperty.prototype, {
	isConstant: {
		get: function () {
			return !1;
		},
	},
	definitionChanged: {
		get: function () {
			return this._definitionChanged;
		},
	},
	image: createPropertyDescriptor("image"),
	repeat: createPropertyDescriptor("repeat"),
	color: createPropertyDescriptor("color"),
	transparent: createPropertyDescriptor("transparent"),
}),
	(PolylineFlowImgMaterialProperty.prototype.getType = function (e) {
		return "PolylineFlowImg";
	}),
	(PolylineFlowImgMaterialProperty.prototype.getValue = function (e, t) {
		defined(t) || (t = {}),
			(t.image = Property.getValueOrUndefined(this._image, e));
		var a = Property.getValueOrClonedDefault(
				this._repeat,
				e,
				defaultRepeat,
				t.repeat
			),
			r = 1,
			i = this.duration;
		if (this._scene && this._meterLength) {
			var n = this._computePixelSizeAtCoordinate(),
				o = this._meterLength / n;
			if (this.flowAxisY) {
				r = o / (this._repeat._value.y || 1);
				(changeRepeat.x = this._repeat._value.x), (changeRepeat.y = r);
			} else {
				r = o / (this._repeat._value.x || 1);
				(changeRepeat.x = r), (changeRepeat.y = this._repeat._value.y);
			}
			(i = o * this.duration), (a = changeRepeat);
		}
		return (
			(t.repeat = a || new Cartesian2(1, 1)),
			(t.color = Property.getValueOrClonedDefault(
				this._color,
				e,
				defaultColor,
				t.color
			)),
			(t.time = ((new Date().getTime() - this._time) % i) / i),
			(t.shiness = this.shiness),
			(t.flowAxisY = this.flowAxisY),
			t
		);
	}),
	(PolylineFlowImgMaterialProperty.prototype._computePixelSizeAtCoordinate =
		function () {
			var e = this._scene.camera,
				t = this._scene.canvas,
				a = e.frustum,
				r = Cartographic.fromCartesian(e.position),
				i = new Cartesian2();
			return a.getPixelDimensions(
				t.clientWidth,
				t.clientHeight,
				r.height,
				this._scene.pixelRatio,
				i
			).x;
		})	,
	(PolylineFlowImgMaterialProperty.prototype.equals = function (e) {
		return (
			this === e ||
			(e instanceof PolylineFlowImgMaterialProperty &&
				Property.equals(this._image, e._image) &&
				Property.equals(this._color, e._color) &&
				Property.equals(this._transparent, e._transparent) &&
				Property.equals(this._repeat, e._repeat))
		);
	}),
	(Material.PolylineFlowImgType = "PolylineFlowImg"),
	(Material.PolylineShineImgSource =
		"czm_material czm_getMaterial(czm_materialInput materialInput)\n{\n    czm_material material = czm_getDefaultMaterial(materialInput);\n    vec2 st = materialInput.st;\n    vec2 newSt =vec2(fract(materialInput.st.s - time), materialInput.st.t);\n    \n    if(flowAxisY) \n    {\n       newSt =vec2(materialInput.st.s,fract(materialInput.st.t - time)); \n    }\n    material.diffuse = texture2D(image, fract(repeat * newSt)).rgb * color.rgb;\n    if (shiness<0.0001)\n    {\n        material.alpha = texture2D(image, fract(repeat * newSt)).a * color.a;\n        return material;\n    }\n    if(st.t<0.3)\n    {\n        material.alpha =st.t*shiness;\n    }\n    else if(st.t>0.7)\n    {\n        material.alpha =(1.0-st.t)*shiness;\n    }\n    else\n    {\n        material.alpha = texture2D(image, fract(repeat * vec2(fract(materialInput.st.s - time), materialInput.st.t))).a* color.a;\n    }\n    return material;\n}"),
	Material._materialCache.addMaterial(Material.PolylineFlowImgType, {
		fabric: {
			type: Material.PolylineFlowImgType,
			uniforms: {
				image: Material.DefaultImageId,
				repeat: new Cartesian2(1, 1),
				color: new Color(1, 1, 1, 1),
				time: 0,
				shiness: 0.5,
				flowAxisY: !1,
			},
			source: Material.PolylineShineImgSource,
		},
		translucent: function (e) {
			return !0;
		},
	});
export default PolylineFlowImgMaterialProperty;
