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
		const flattenAreaWC = Cesium.Cartesian3.fromDegreesArray([
			-71.05546970246004, 42.35253974644013,
			-71.0558516046633, 42.3517911739237,
			-71.0574638361963, 42.3521936048791,
			-71.05706149040155, 42.352934202982,
		]);
		const modelMatrix = Cesium.Matrix4.IDENTITY;
		const modelMatrixInv = Cesium.Matrix4.inverse(modelMatrix, new Cesium.Matrix4());
		const flattenAreaMC = flattenAreaWC.map(point => {
			return Cesium.Matrix4.multiplyByPoint(modelMatrixInv, point,new Cesium.Cartesian3());
		});
		const flattenAreaMC_ = flattenAreaMC.map((pointMC) => {
			return [pointMC.x, pointMC.y, pointMC.z];
		});
		const [a, b, c] = planeFit(flattenAreaMC_);
		console.log("模型空间的平面方程", [a, b, c]);
		// 着色器uniforms
		const uniforms = {
			planeNormalMC: {
				type: Cesium.UniformType.VEC3,
				value: new Cesium.Cartesian3(a, b, c),
			},
			point1: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaMC[0],
			},
			point2: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaMC[1],
			},
			point3: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaMC[2],
			},
			point4: {
				type: Cesium.UniformType.VEC3,
				value: flattenAreaMC[3],
			}
		};
		// 拟合模型平面
		const tileset = this.viewer.scene.primitives.add(
			new Cesium.Cesium3DTileset({
				url: Cesium.IonResource.fromAssetId(354759),
				customShader: new Cesium.CustomShader({
					uniforms: uniforms,
					vertexShaderText: `
					void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput)
					{
						vec3 positionMC = vsInput.attributes.positionMC;
						float r = (dot(planeNormalMC,positionMC)+1.0)/pow(length(planeNormalMC),2.0);
						vec3 positionMC_ = positionMC - r * planeNormalMC;
						vec3 v1 = normalize(point1 - positionMC_);
						vec3 v2 = normalize(point2 - positionMC_);
						vec3 v3 = normalize(point3 - positionMC_);
						vec3 v4 = normalize(point4 - positionMC_);
						float angle1 = degrees(acos(dot(v1 , v2)));
						float angle2 = degrees(acos(dot(v2 , v3)));
						float angle3 = degrees(acos(dot(v3 , v4)));
						float angle4 = degrees(acos(dot(v4 , v1)));
						float angle = angle1 + angle2 + angle3 + angle4;
						
					}
					`,
				}),
			})
		);
		this.viewer.flyTo(tileset);
		window.x = tileset;
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
