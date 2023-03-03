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
		debugger;
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
				value: flattenAreaCenter,
			},
			point1: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaWC[0],
			},
			point2: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaWC[1],
			},
			point3: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaWC[2],
			},
			point4: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaWC[3],
			},
		};
		// 拟合模型平面
		const vertexShaderText = `
		void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
    		vec4 positionMC_ = vec4(vsInput.attributes.positionMC , 1);
			vec4 positionWC_ = czm_model * positionMC_;
			float lambda = (dot(planeNormal , positionWC_.xyz) - dot(planeNormal , flattenAreaCenter)) / dot(planeNormal , planeNormal);
			vec3 positionOnPlane = positionWC_.xyz - lambda * planeNormal;
			vec3 v1 = normalize(point1 - positionOnPlane);
			vec3 v2 = normalize(point2 - positionOnPlane);
			vec3 v3 = normalize(point3 - positionOnPlane);
			vec3 v4 = normalize(point4 - positionOnPlane);
			float angle = acos(dot(v1 , v2 )) + acos(dot(v2 , v3 )) + acos(dot(v3 , v4 )) + acos(dot(v4 , v1 ));
			float pi = 3.1415926;
			if ( abs(angle - 2.0*pi) < 0.1){
				vec4 positionOnPlane_ = vec4( positionOnPlane , 1);
				positionMC_ = czm_inverseModel * positionOnPlane_;
			}
			vsOutput.positionMC = positionMC_.xyz;
  		}
		`;
		const tileset = this.viewer.scene.primitives.add(
			new Cesium.Cesium3DTileset({
				url: Cesium.IonResource.fromAssetId(354759),
				show: true,
				customShader: new Cesium.CustomShader({
					uniforms: uniforms,
					vertexShaderText: vertexShaderText,
				}),
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
