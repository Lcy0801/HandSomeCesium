import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";

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
			return Cesium.Matrix4.multiplyByPoint(modelMatrixInv, point);
		});
		// 拟合模型平面
		const tileset = this.viewer.scene.primitives.add(
			new Cesium.Cesium3DTileset({
				url: Cesium.IonResource.fromAssetId(354759),
				// customShader: new Cesium.CustomShader({
				// 	vertexShaderText: `
				// 	void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput)
				// 	{

				// 	}
				// 	`,
				// }),
			})
		);
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
