import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";

class Map3D { 
    initMap(container) { 
        Cesium.Ion.defaultAccessToken = CesiumToken;
        this.viewer = new Cesium.Viewer(container, {
            timeline: false,
            animation:false,
			shouldAnimate: true,
			imageryProvider:new Cesium.OpenStreetMapImageryProvider()
		});
		window.viewer = this.viewer;
		window.map3d = this;
		window.Cesium = Cesium;
		this.load3dTiles();
		this.viewer.camera.setView({
			destination: Cesium.Cartesian3.fromDegrees(
				121.50355,
				31.22690504445818,
				1000
			),
			orientation: Cesium.HeadingPitchRoll.fromDegrees(0, -30, 0),
		});
	}
	load3dTiles() { 
		const tileset = this.viewer.scene.primitives.add(
			new Cesium.Cesium3DTileset({
				url: Cesium.IonResource.fromAssetId(96188),
			})
		);
	}
}
export default new Map3D();