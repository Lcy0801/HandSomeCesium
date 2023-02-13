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
		this.drawRadarPrimitive();
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
    drawRadarPrimitive() {
		const minRadius = 10.0;
		const maxRadius = 100.0;
		const center = Cesium.Cartesian3.fromDegrees(120, 31, 100);
		const shderSource = `
            czm_material czm_getMaterial(czm_materialInput materialInput)
            {
                czm_material m = czm_getDefaultMaterial(materialInput);
                m.diffuse = vec3(0.5);
                m.specular = 0.5;
                return m;
            }
        `;
		const vertexShaderSource = `
            attribute vec3 position3DHigh;
            attribute vec3 position3DLow;
            attribute vec3 normal;
            attribute vec2 st;
            attribute float batchId;
            vec3 center =vec3( -2736038.438081371, 4738957.586218331, 3265945.020461434);

            varying vec4 v_color;
            void main()
            {
                vec4 p = czm_computePosition();
                vec4 eyePosition = czm_modelViewRelativeToEye * p;
                p =  czm_inverseModelView * eyePosition;
                vec4 worldPosition = czm_model * p;
                vec4 centerPostion = vec4(center,1.0);
                vec4 diff = worldPosition - centerPostion;
                float dist = sqrt(diff.x * diff.x + diff.y * diff.y + diff.z * diff.z);
                if (dist > 40.0)
                {
                    v_color=vec4(1,0,0,1);
                }
                else
                {
                    v_color=vec4(0,1,0,1);
                }
                gl_Position = czm_modelViewProjection * p;
            }
        `;
		const fragmentShaderSource = `
            varying vec4 v_color;
            void main() {
                gl_FragColor = v_color;
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
								center: center,
							},
						},
					}),
					vertexShaderSource: vertexShaderSource,
					fragmentShaderSource: fragmentShaderSource,
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
