import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import TracePoints from "./data/point.json" assert { type: "json" };
import TraceInterpolation from "./interpolation";
import * as mathjs from "mathjs";
import * as turf from "@turf/turf";

class Map3D {
	initMap(container) {
		window.points = {
			type: 'FeatureCollection',
			features: []
		};
		TracePoints.features.splice(0, 80);
		Cesium.Ion.defaultAccessToken = CesiumToken;
		this.viewer = new Cesium.Viewer(container, {
			timeline: false,
			animation: false,
			shouldAnimate: true,
		});
		this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date());
		console.log(Cesium.JulianDate.toDate(this.viewer.clock.currentTime));
		this.viewer.shouldAnimate = false;
		setTimeout(() => {
			this.viewer.shouldAnimate = true;
			console.log(Cesium.JulianDate.toDate(this.viewer.clock.currentTime));
		}, 5000);
		console.log("打印相关的信息");
		const carEntity = this.viewer.entities.add({
			model: {
				uri: "car3.gltf",
				scale: 1,
			},
			position: Cesium.Cartesian3.fromDegrees(119.421871, 31.0362196,30),
			orientation: Cesium.Transforms.headingPitchRollQuaternion(
				Cesium.Cartesian3.fromDegrees(119.421871, 31.0362196,30),
				new Cesium.HeadingPitchRoll(0, 0, 0)
			),
		});
		this.viewer.zoomTo(carEntity);
		// this.viewer.camera.lookAt(
		// 	Cesium.Cartesian3.fromDegrees(119.421871, 31.0362196),
		// 	new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-15), 1000)
		// );
		// this.viewer.camera.setView({
		// 	destination: Cesium.Cartesian3.fromDegrees(
		// 		119.406208,
		// 		31.025257,
		// 		1500
		// 	),
		// 	orientation: Cesium.HeadingPitchRoll.fromDegrees(45, -45, 0),
		// });
		this.interpolation();
		this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(
			new Date(TracePoints.features[0].properties.t)
		);
		const that = this;
		const interpolationPointDataSource = new Cesium.CustomDataSource(
			"point"
		);
		this.viewer.dataSources.add(interpolationPointDataSource);
		this.viewer.scene.postRender.addEventListener(() => {
			const t = Cesium.JulianDate.toDate(
				that.viewer.clock.currentTime
			).getTime();
			let index;
			for (let i = 0; i < TracePoints.features.length; i++) {
				const t_ = TracePoints.features[i].properties.t;
				if (t < t_) {
					index = i-1;
					break;
				}
			}
			if (!index) {
				return;
			}
			const point_ = that.traceInterpolations[index].getCoordinate(t);
			if (!point_) { 
				return;
			}
			window.points.features.push({
				type: 'Feature',
				properties: {
					index0: index - 1,
					index1: index,
					id:window.points.features.length
				},
				geometry: {
					type: 'Point',
					coordinates: [point_.longitude, point_.latitude]
				}
			});
			// console.log("插值轨迹点", index, point_);
			interpolationPointDataSource.entities.add({
				position: Cesium.Cartesian3.fromDegrees(
					point_.longitude,
					point_.latitude,
					10
				),
				point: {
					pixelSize: 5,
					color: Cesium.Color.YELLOW,
				},
			});
			
			const point__ = that.traceInterpolations[index].getCoordinate(
				t - 1
			);
			let heading = turf.bearing(
				[point__.longitude, point__.latitude],
				[point_.longitude, point_.latitude]
			);
			if (heading < 0) { 
				heading += 360;
			}
			if (!this.carStstus[index]) { 
				heading += 180;
				if (heading > 360) { 
					heading -= 360;
				}

			}
			const position = Cesium.Cartesian3.fromDegrees(
				point_.longitude,
				point_.latitude,
				10
			);
			const hpr = Cesium.HeadingPitchRoll.fromDegrees(heading, 0, 0);
			const qua = Cesium.Transforms.headingPitchRollQuaternion(
				position,
				hpr,
				Cesium.Ellipsoid.WGS84,
				Cesium.Transforms.localFrameToFixedFrameGenerator(
					"north",
					"west"
				)
			);
			carEntity.position = position;
			carEntity.orientation = qua;
		});
		window.mathjs = mathjs;
	}
	interpolation() {
		let flag = true;
		this.carStstus = {};
		this.traceInterpolations = [];
		const points = TracePoints.features;
		const num = points.length;
		for (let i = 0; i < num - 1; i++) {
			let currentPoint = points[i];
			let nextPoint = points[i + 1];
			if (i > 0) {
				let lastPoint = points[i - 1];
				let diffAngle = Math.abs(
					currentPoint.properties.dir - lastPoint.properties.dir
				);
				diffAngle = diffAngle > 180 ? 360 - diffAngle : diffAngle;
				if (diffAngle > 150) {
					flag = !flag;
				}
			}
			this.carStstus[i] = flag;
			const start = {
				t: currentPoint.properties.t,
				latitude: currentPoint.geometry.coordinates[1],
				longitude: currentPoint.geometry.coordinates[0],
				speed: currentPoint.properties.speed / 3.6,
				direction: currentPoint.properties.dir,
			};
			const end = {
				t: nextPoint.properties.t,
				latitude: nextPoint.geometry.coordinates[1],
				longitude: nextPoint.geometry.coordinates[0],
				speed: nextPoint.properties.speed / 3.6,
				direction: nextPoint.properties.dir,
			};
			const diff = Math.abs(end.direction - start.direction);
			if (diff > 150) { 
				end.direction += 180;
				end.direction = end.direction % 360;
			}
			let traceInterpolation = new TraceInterpolation(
				start,
				end,
				TracePoints.features[0].properties.t
			);
			// let point_ = traceInterpolation.getCoordinate(start.t);
			// console.log(point_, start, end, "验证");
			// console.log(
			// 	traceInterpolation.lonFunc,
			// 	traceInterpolation.latFunc,
			// 	"插值函数",
			// 	i
			// );
			this.traceInterpolations.push(traceInterpolation);
			this.viewer.entities.add({
				position: Cesium.Cartesian3.fromDegrees(
					currentPoint.geometry.coordinates[0],
					currentPoint.geometry.coordinates[1],
					10
				),
				point: {
					pixelSize: 3,
					color: Cesium.Color.RED,
				},
			});
		}
		console.log(this.carStstus,"倒车状态判断");
	}
}
export default new Map3D();
