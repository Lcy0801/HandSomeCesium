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
		this.drawRadar();
    }
    //通过纹理贴图
	drawRadar() {
		const minRadius = 0;
		const maxRadius = 100;
		let majorR = minRadius;
		let minorR = minRadius;
		// 准备纹理贴图
		const canvas = document.createElement("canvas");
		canvas.width = 100;
		canvas.height = 100;
		const context = canvas.getContext("2d");
		const gradient = context.createRadialGradient(50, 50, 0, 50, 50, 50);
		gradient.addColorStop(0, "rgba(255,0,0,0.2)");
		gradient.addColorStop(1, "rgba(255,0,0,0.8)");
		context.fillStyle = gradient;
		context.beginPath();
		context.arc(50, 50, 50, 0, Math.PI * 2);
		context.closePath();
		context.fill();

		const entity = this.viewer.entities.add({
			position: Cesium.Cartesian3.fromDegrees(121, 30),
			ellipse: {
				semiMajorAxis: new Cesium.CallbackProperty(() => {
					majorR += 0.2;
					majorR = majorR > maxRadius ? minRadius : majorR;
					return majorR;
				}, false),
				semiMinorAxis: new Cesium.CallbackProperty(() => {
					minorR += 0.2;
					minorR = minorR > maxRadius ? minRadius : minorR;
					return minorR;
				}, false),
				height: 100,
				fill: true,
				material: new Cesium.ImageMaterialProperty({
					image: canvas,
					repeat: new Cesium.Cartesian2(1, 1),
					transparent: true,
				}),
			},
		});
		this.viewer.zoomTo(entity);
    }
    //通过自定义着色器
    
}
export default new Map3D();
