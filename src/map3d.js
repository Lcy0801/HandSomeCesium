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
		// this.drawRadarEntity();
		// this.drawRadarPrimitive();
		this.drawScanRadarPrimitive();
	}
	//通过纹理贴图
	drawRadarEntity() {
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
	//可以基于纹理坐标来计算相对的位置关系
	drawRadarPrimitive() {
		const center = Cesium.Cartesian3.fromDegrees(120, 31, 100);
		const shaderSource = `
            czm_material czm_getMaterial(czm_materialInput materialInput)
            {
                czm_material m = czm_getDefaultMaterial(materialInput);
                vec2 st = materialInput.st;
                vec2 center_st = vec2(0.5,0.5);
                float r = mod(czm_frameNumber,framePeriod) / framePeriod;
                float dist = distance(st,center_st);
                if (dist > r){
                    m.alpha = 0.0;
                }
                else{
                    m.alpha = dist / r;
                }
                m.diffuse = vec3(1,0,0);
                return m;
            }
        `;

		this.viewer.scene.primitives.add(
			new Cesium.Primitive({
				geometryInstances: {
					geometry: new Cesium.EllipseGeometry({
						center: center,
						semiMajorAxis: 100,
						semiMinorAxis: 100,
						height: 100,
					}),
					modelMatrix: Cesium.Matrix4.IDENTITY,
				},
				appearance: new Cesium.MaterialAppearance({
					material: new Cesium.Material({
						fabric: {
							type: "radarSwap",
							uniforms: {
								minR: minRadius,
								maxR: maxRadius,
								framePeriod: 300.0,
							},
							source: shaderSource,
						},
					}),
				}),
			})
		);
		this.viewer.camera.lookAt(
			Cesium.Cartesian3.fromDegrees(120, 31),
			new Cesium.HeadingPitchRange(0, -45, 100)
		);
	}
	//自定义着色器实现扇形雷达
	drawScanRadarPrimitive() {
		const center = Cesium.Cartesian3.fromDegrees(120, 31, 100);
		const shaderSource = `
            czm_material czm_getMaterial(czm_materialInput materialInput)
            {
                czm_material m = czm_getDefaultMaterial(materialInput);
                vec2 st = materialInput.st;
                vec2 center_st = vec2(0.5,0.5);
                float startAngle = mod(czm_frameNumber * scanSpeed,360.0);
				if (startAngle < 0.0)
				{
					startAngle = startAngle + 360.0;
				}
				float x1 = 0.5 + cos(radians(startAngle));
				float y1 = 0.5 + sin(radians(startAngle));
				vec3 vStart = vec3(x1 - 0.5 , y1 - 0.5 , 0.0);
				vStart = normalize(vStart);
				vec3 vFrag = vec3(st.x - 0.5 , st.y - 0.5 , 0.0);
				vFrag = normalize(vFrag);
				float angle = degrees(acos(dot(vStart , vFrag)));
				float flag = cross(vFrag , vStart).z;
				if (flag >= 0.0)
				{
					angle = 360.0 - flag;
				}
				m.alpha = 0.0;
				if (angle <= scanAngle)
				{
					m.alpha = angle / scanAngle;
					if(scanSpeed < 0.0)
					{
						m.alpha = 1.0 - m.alpha;
					}
				}
                m.diffuse = vec3(1,0,0);
                return m;
            }
        `;

		this.viewer.scene.primitives.add(
			new Cesium.Primitive({
				geometryInstances: {
					geometry: new Cesium.EllipseGeometry({
						center: center,
						semiMajorAxis: 1000,
						semiMinorAxis: 1000,
						height: 0,
					}),
					modelMatrix: Cesium.Matrix4.IDENTITY,
				},
				appearance: new Cesium.MaterialAppearance({
					material: new Cesium.Material({
						fabric: {
							type: "radarSwap",
							uniforms: {
								scanAngle: 60.0,
								scanSpeed: -1.0,
							},
							source: shaderSource,
						},
					}),
				}),
			})
		);
		this.viewer.camera.lookAt(
			Cesium.Cartesian3.fromDegrees(120, 31),
			new Cesium.HeadingPitchRange(0, -45, 100)
		);
	}
}
export default new Map3D();
