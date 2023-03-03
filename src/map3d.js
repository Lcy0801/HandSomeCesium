import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import { planeFit } from "./utils";

class Map3D {
	initMap(container) {
		Cesium.Ion.defaultAccessToken = CesiumToken;
		this.viewer = new Cesium.Viewer(container, {
			timeline: false,
			animation: false,
			shouldAnimate: true,
		});
		const flattenAreaWC = Cesium.Cartesian3.fromDegreesArrayHeights([
			-71.05546970246004, 42.35253974644013, 10, -71.0558516046633,
			42.3517911739237, 10, -71.0574638361963, 42.3521936048791, 10,
			-71.05706149040155, 42.352934202982, 10,
		]);
		this.viewer.entities.add({
			polyline: {
				positions: [...flattenAreaWC, flattenAreaWC[0]],
				material: Cesium.Color.RED,
			},
		});
		const flattenAreaWC_ = flattenAreaWC.map((point) => {
			return [point.x, point.y, point.z];
		});
		const [a, b, c] = planeFit(flattenAreaWC_);
		const flattenAreaCenter_ = flattenAreaWC.reduce(
			(previousV, cueerntV) => {
				return Cesium.Cartesian3.add(
					previousV,
					cueerntV,
					new Cesium.Cartesian3()
				);
			},
			new Cesium.Cartesian3()
		);
		const flattenAreaCenter = Cesium.Cartesian3.divideByScalar(
			flattenAreaCenter_,
			flattenAreaWC.length,
			new Cesium.Cartesian3()
		);
		// 着色器uniforms
		const uniforms = {
			planeNormal: {
				type: Cesium.UniformType.VEC3,
				value: new Cesium.Cartesian3(a, b, c),
			},
			flattenAreaCenter: {
				type: Cesium.UniformType.VEC3,
				value:flattenAreaCenter
			},
			point1: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaWC[0],
			},
			point2: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaCenter[1],
			},
			point3: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaCenter[2],
			},
			point4: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaCenter,
			},
		};
		// 拟合模型平面
		const vertexShaderText = `
		void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
    		vec4 positionMC_ = vec4(vsInput.attributes.positionMC , 1);
			vec4 positionWC_ = czm_model * positionMC_;
			float lambda = (dot(planeNormal , positionWC_.xyz) - dot(planeNormal , flattenAreaCenter)) / dot(planeNormal , planeNormal);
			vec4 positionOnPlane = positionWC_.xyz - lambda * planeNormal;
  		}
		`;
		const tileset = this.viewer.scene.primitives.add(
			new Cesium.Cesium3DTileset({
				url: Cesium.IonResource.fromAssetId(354759),
				show: true,
				customeShader: new Cesium.CustomShader({
					uniforms: uniforms,
					vertexShaderText:vertexShaderText
				})
			})
		);
		window.tileset = tileset;
		this.viewer.flyTo(tileset);
		const that = this;
		this.viewer.screenSpaceEventHandler.setInputAction((event) => {
			const position = that.viewer.scene.pickPosition(event.position);
			const position_ = Cesium.Cartographic.fromCartesian(position);
			const lon = Cesium.Math.toDegrees(position_.longitude);
			const lat = Cesium.Math.toDegrees(position_.latitude);
			console.log(lon, lat);
		}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
	}
}
export default new Map3D();
