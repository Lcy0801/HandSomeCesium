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
        this.demo();
		this.drawDataSource = new Cesium.CustomDataSource("draw");
		this.drawPoints = [];
		this.viewer.dataSources.add(this.drawDataSource);
		this.viewer.screenSpaceEventHandler.setInputAction(
			(event) => {
				this.viewer.entities.removeById("drawLine");
				const pos = this.viewer.scene.pickPosition(event.position);
				console.log(pos);
				this.drawDataSource.entities.add({
					position: pos,
					point: {
						color: Cesium.Color.RED,
						pixelSize: 5,
					},
				});
				this.drawPoints.push(pos);
			},
			Cesium.ScreenSpaceEventType.LEFT_CLICK,
			Cesium.KeyboardEventModifier.ALT
		);
		this.viewer.screenSpaceEventHandler.setInputAction(
			(event) => {
				if (this.drawPoints.length >= 3) {
					this.viewer.entities.add({
						id: "drawLine",
						polyline: {
							positions: [...this.drawPoints, this.drawPoints[0]],
							material: new Cesium.ColorMaterialProperty(
								Cesium.Color.YELLOW
							),
							clampToGround: true,
						},
					});
					this.modelFlatten();
				}
				this.drawPoints = [];
				this.drawDataSource.entities.removeAll();
			},
			Cesium.ScreenSpaceEventType.RIGHT_CLICK,
			Cesium.KeyboardEventModifier.ALT
		);
		// this.tileset = this.viewer.scene.primitives.add(
		// 	new Cesium.Cesium3DTileset({
		// 		url: Cesium.IonResource.fromAssetId(57590),
		// 		outlineColor: Cesium.Color.RED,
		// 	})
		// );
		// this.viewer.flyTo(this.tileset);
	}
	modelFlatten() {
		// const flattenHeight = -1000;
		// const modelMatrix_ = Cesium.Matrix4.inverse(
		// 	this.tileset.modelMatrix,
		// 	new Cesium.Matrix4()
		// );
		// this.drawPoints_ = this.drawPoints.map((point) => {
		// 	let points_ = Cesium.Cartographic.fromCartesian(point);
		// 	points_ = Cesium.Cartesian3.fromRadians(
		// 		points_.longitude,
		// 		points_.latitude,
		// 		flattenHeight
		// 	);
		// 	points_ = Cesium.Matrix4.multiplyByVector(
		// 		modelMatrix_,
		// 		new Cesium.Cartesian4(
		// 			points_.x,
		// 			points_.y,
		// 			points_.z,
		// 			1
		// 		),
		// 		new Cesium.Cartesian4()
		// 	);
		// 	return new Cesium.Cartesian3(
		// 		points_.x / points_.w,
		// 		points_.y / points_.w,
		// 		points_.z / points_.w
		// 	);
		// });
		// // 计算平面法向量
		// let point1 = this.drawPoints_[0];
		// let point2 = this.drawPoints_[1];
		// let point3 = this.drawPoints_[2];
		// let v1 = Cesium.Cartesian3.subtract(
		// 	point2,
		// 	point1,
		// 	new Cesium.Cartesian3()
		// );
		// let v2 = Cesium.Cartesian3.subtract(
		// 	point3,
		// 	point1,
		// 	new Cesium.Cartesian3()
		// );
		// let normal = Cesium.Cartesian3.cross(v1, v2, new Cesium.Cartesian3());
		// normal = Cesium.Cartesian3.normalize(normal, new Cesium.Cartesian3());
		// // 计算重心坐标
		// let center = this.drawPoints_.reduce((preV, item) => {
		// 	return Cesium.Cartesian3.add(preV, item, new Cesium.Cartesian3());
		// }, new Cesium.Cartesian3());
		// center = Cesium.Cartesian3.divideByScalar(
		// 	center,
		//     this.drawPoints_.length,
		//     new Cesium.Cartesian3()
		// );
		// // 拼接uniform
		// const shader = new Cesium.CustomShader({
		// 	uniforms: {
		// 		normal: {
		// 			type: Cesium.UniformType.VEC3,
		// 			value: normal,
		// 		},
		// 		center: {
		// 			type: Cesium.UniformType.VEC3,
		// 			value: center,
		// 		},
		// 	},
		// 	vertexShaderText: `
		//         void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
		//             if(vsInput.attributes.positionMC.x < 0.0){
		//                 vec3 v1=vsInput.attributes.positionMC-center;
		//                 float flag=dot(v1,normal);
		//                 vec3 v2;
		//                 if(flag<0.0){
		//                     v2=-flag*normal;
		//                 }else{
		//                     v2=flag*normal;
		//                 }
		//                 vec3 v3=v1-v2;
		//                 vec3 res=center+v3;
		//                 vsOutput.positionMC=res;
		//             }
		//         }
		//     `,
		// });
		// debugger;
		// this.tileset.show = false;
		// const x = this.viewer.scene.primitives.add(
		// 	new Cesium.Cesium3DTileset({
		// 		url: Cesium.IonResource.fromAssetId(57590),
		// 		customShader: shader,
		// 		outlineColor:Cesium.Color.RED
		// 	})
		// );
		// console.log(x);
		// this.viewer.flyTo(x);
	}
	demo() {
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
                    vec4 p = czm_computePosition();
                    vec4 eyePosition = czm_modelViewRelativeToEye * p;
                    v_positionEC =  czm_inverseModelView * eyePosition;
                    gl_Position = czm_modelViewProjectionRelativeToEye * p;
                }`,
			fragmentShaderSource: `varying vec4 v_positionEC;
                varying vec3 v_normalEC;
                varying vec4 v_color;
                void main() {
                  float l = sqrt(pow(v_positionEC.x,2.0) + pow(v_positionEC.y,2.0) + pow(v_positionEC.z,2.0)); // 距离模型坐标系原点的距离
                  float cy3 = fract((abs(l - 1000.0))/2000.0); 
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
						Cesium.Cartesian3.fromDegrees(118.999861111111, 29, 500)
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
        // this.viewer.flyTo(primitive);
	}
}
export default new Map3D();
