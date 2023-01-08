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
		this.viewer.camera.lookAt(
			Cesium.Cartesian3.fromDegrees(121, 30),
			new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-15), 1000)
		);
		this.drawDataSource = new Cesium.CustomDataSource("draw");
		this.drawPoints = [];
		this.viewer.dataSources.add(this.drawDataSource);
		this.viewer.screenSpaceEventHandler.setInputAction(
			(event) => {
				this.viewer.scene.primitives.remove(this.wall);
				const ray = this.viewer.camera.getPickRay(event.position);
				const pos = this.viewer.scene.globe.pick(
					ray,
					this.viewer.scene
				);
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
					this.dynamicWall();
				}
				this.drawPoints = [];
				this.drawDataSource.entities.removeAll();
			},
			Cesium.ScreenSpaceEventType.RIGHT_CLICK,
			Cesium.KeyboardEventModifier.ALT
		);
	}

	dynamicWall() {
		// 计算重心坐标
		let center = this.drawPoints.reduce((pre, curV) => {
			return Cesium.Cartesian3.add(pre, curV, new Cesium.Cartesian3());
		}, new Cesium.Cartesian3());
		center = Cesium.Cartesian3.divideByScalar(center, this.drawPoints.length, new Cesium.Cartesian3());
		let modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(center);
		modelMatrix = Cesium.Matrix4.inverse(modelMatrix,new Cesium.Matrix4());
		this.drawPoints = [...this.drawPoints, this.drawPoints[0]];
		const minHeight = 0;
		const maxHeight = 1000;
		const wallGeometry = new Cesium.WallGeometry({
			positions: this.drawPoints,
			maximumHeights: this.drawPoints.map(() => {
				return maxHeight;
			}),
			minimumHeights: this.drawPoints.map(() => {
				return minHeight;
			}),
		});
		this.wall = this.viewer.scene.primitives.add(
			new Cesium.Primitive({
				geometryInstances: {
					geometry: wallGeometry,
					modelMatrix: Cesium.Matrix4.IDENTITY,
					attributes: {
						color: Cesium.ColorGeometryInstanceAttribute.fromColor(
							Cesium.Color.RED
						),
					},
				},
				appearance: new Cesium.MaterialAppearance({
					material: new Cesium.Material({
						fabric: {
							uniforms: {
								modelMatrix: modelMatrix,
								maxHeight: maxHeight,
								minHeight: minHeight,
							},
						},
					}),
					vertexShaderSource: `
						attribute vec4 color;
						varying vec4 v_color;
						varying x
						void main()
						{
							vec4 p = czm_computePosition();
							vec4 eyePosition = czm_modelViewRelativeToEye * p;
							p =  czm_inverseModelView * eyePosition;
							vec4 worldPosition= czm_model * p;
							vec4 enuPosition=modelMatrix*worldPosition;
							float u=max(enuPosition.z,minHeight);
							float alpha=fract((u-minHeight)/(maxHeight-minHeight));
							v_color=vec4(color.rgb,alpha)
							gl_Position = czm_modelViewProjection * p;
						}
					`,
					fragmentShaderSource: `
						varying vec4 v_color;
						void main() {
							gl_FragColor = v_color;
						}
					`,
				}),
			})
		);
	}
}
export default new Map3D();
