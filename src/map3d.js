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
		// 自定义顶点着色器和片源着色器
		let appearance = new Cesium.MaterialAppearance({
			vertexShaderSource: `
                attribute vec3 position3DHigh;  
                attribute vec3 position3DLow;
                attribute float batchId;
                varying vec4 v_positionEC;
 
                attribute vec4 color;
                varying vec4 v_color;
 
                void main()
                {
                    v_color = color;
                    vec4 p = czm_computePosition(); // 获取模型相对于视点位置
                    vec4 eyePosition = czm_modelViewRelativeToEye * p; // 由模型坐标 得到视点坐标
                    v_positionEC =  czm_inverseModelView * eyePosition;   // 视点在 模型坐标系中的位置
                    gl_Position = czm_modelViewProjection * v_positionEC;  // 视点坐标转为屏幕坐标
                }
                    `,
			fragmentShaderSource: `           
                varying vec4 v_positionEC;
                varying vec3 v_normalEC;
                varying vec4 v_color;
                void main() {
                  float l = sqrt(pow(v_positionEC.x,2.0) + pow(v_positionEC.y,2.0) + pow(v_positionEC.z,2.0)); // 距离模型坐标系原点的距离
                  float cy3 = fract(1.0-(v_positionEC.z+500.0)/1000.0); 
                  float alpha = cy3;
                  gl_FragColor = vec4(v_color.rgb,alpha);
                }
                `,
		});

		let primitive = this.viewer.scene.primitives.add(
			new Cesium.Primitive({
				geometryInstances: new Cesium.GeometryInstance({
					geometry: Cesium.BoxGeometry.fromDimensions({
						vertexFormat:
							Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
						dimensions: new Cesium.Cartesian3(300.0, 300.0, 1000.0),
					}),
					modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
						Cesium.Cartesian3.fromDegrees(118.999861111111, 29, 0)
					),
					attributes: {
						color: Cesium.ColorGeometryInstanceAttribute.fromColor(
							Cesium.Color.YELLOW.withAlpha(1)
						),
					},
				}),
				appearance: appearance,
			})
		);
		this.viewer.camera.lookAt(
			Cesium.Cartesian3.fromDegrees(118.999861111111, 29, 500),
			new Cesium.HeadingPitchRange(0, -10, 3000)
		);
	}
}
export default new Map3D();
