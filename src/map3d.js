import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import { fromUrl } from "geotiff";



// 地理坐标转像素坐标
function lonlat2xy(lon, lat) {
	const geot = [
		119.40963015669057, 9.778801492523904e-6, 0.0, 31.05982883083611, 0.0,
		-9.778801492523646e-6,
	];
	const px =
		(geot[5] * lon -
			geot[2] * lat -
			geot[0] * geot[5] +
			geot[2] * geot[3]) /
		(geot[1] * geot[5] - geot[2] * geot[4]);
	const py =
		(geot[4] * lon -
			geot[1] * lat +
			geot[1] * geot[3] -
			geot[4] * geot[0]) /
		(geot[2] * geot[4] - geot[1] * geot[5]);
	return [px, py];
}

class Map3D {
	async initMap(container) {
		Cesium.Ion.defaultAccessToken = CesiumToken;
		this.viewer = new Cesium.Viewer(container, {
			timeline: false,
			animation: false,
			shouldAnimate: true,
		});
		// 读取tif影像
		const tif = await fromUrl("HeightMap_res1m_4326.tif");
		const image = await tif.getImage();
		const origin = image.getOrigin();
		const resolution = image.getResolution();
		console.log("原点和分辨率", origin, resolution);
		this.viewer.screenSpaceEventHandler.setInputAction(async (event) => {
			const ray = this.viewer.camera.getPickRay(event.position);
			const cartesian = this.viewer.scene.globe.pick(
				ray,
				this.viewer.scene
			);
			const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
			const lon = Cesium.Math.toDegrees(cartographic.longitude); // 经度
			const lat = Cesium.Math.toDegrees(cartographic.latitude); // 纬度
			const [px, py] = lonlat2xy(lon, lat);
			const readW = [
				Math.floor(px),
				Math.floor(py),
				Math.floor(px) + 1,
				Math.floor(py) + 1,
			];
			const [dem] = await tif.readRasters({
				window: readW,
				samples: [0],
			});
			console.log(dem[0], "读取到的数据");
		}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
		this.viewer.camera.setView({
			destination: Cesium.Cartesian3.fromDegrees(119.419715, 31.043982),
			orientation: Cesium.HeadingPitchRoll.fromDegrees(0, -45, 0),
		});
	}
}
export default new Map3D();
