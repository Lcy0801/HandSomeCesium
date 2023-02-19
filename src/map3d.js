import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import traceData from "./data/Trace_.json";
import * as turf from "@turf/turf";
import TraceInterpolation from "./interpolation";

class Map3D {
	initMap(container) {
		Cesium.Ion.defaultAccessToken = CesiumToken;
		this.viewer = new Cesium.Viewer(container, {
			timeline: false,
			animation: false,
			shouldAnimate: false,
			terrainProvider: new Cesium.CesiumTerrainProvider({
				url: Cesium.IonResource.fromAssetId(1),
			}),
		});
		this.viewer.camera.setView({
			destination: Cesium.Cartesian3.fromDegrees(
				traceData.features[0].geometry.coordinates[0],
				traceData.features[0].geometry.coordinates[1],
				100
			),
			orientation: Cesium.HeadingPitchRoll.fromDegrees(0, -45, 0),
		});
		window.viewer = this.viewer;
		setTimeout(() => {
			this.carMove();
		}, 10000);
	}
	carMove() {
		const points = traceData.features;
		const tracePointDataSource = new Cesium.CustomDataSource("tracePoint");
		this.viewer.dataSources.add(tracePointDataSource);
		//绘制轨迹点
		points.forEach((point) => {
			const position = Cesium.Cartographic.fromDegrees(
				point.geometry.coordinates[0],
				point.geometry.coordinates[1]
			);
			this.viewer.scene
				.sampleHeightMostDetailed([position])
				.then((value) => {
					const position_ = Cesium.Cartographic.toCartesian(value[0]);
					tracePointDataSource.entities.add({
						position: position_,
						point: {
							color: Cesium.Color.RED,
							pixelSize: 5,
							heightReference:
								Cesium.HeightReference.CLAMP_TO_GROUND,
						},
					});
				});
		});
		//绘制轨迹线
		const traceLine = this.viewer.entities.add({
			polyline: {
				positions: points.map((point) => {
					return Cesium.Cartesian3.fromDegrees(
						point.geometry.coordinates[0],
						point.geometry.coordinates[1]
					);
				}),
				material: new Cesium.ColorMaterialProperty(Cesium.Color.ORANGE),
				clampToGround: true,
				width: 2,
			},
		});
		// 计算轨迹点的速度和方向
		const num = points.length;
		const points_ = [];
		for (let index = 0; index < num; index++) {
			const point = points[index];
			const lastPoint = index === 0 ? points[1] : points[index - 1];
			const dist = turf.distance(
				point.geometry.coordinates,
				lastPoint.geometry.coordinates,
				{ units: "meters" }
			);
			const dt =
				Math.abs(point.properties.t - lastPoint.properties.t) / 1000;
			const speed = dist / dt;
			const bearing = turf.bearing(
				lastPoint.geometry.coordinates,
				point.geometry.coordinates
			);
			const bearing_ = bearing < 0 ? bearing + 360 : bearing;
			const direction = index === 0 ? (bearing_ + 180) % 360 : bearing_;
			points_.push({
				t: point.properties.t,
				longitude: point.geometry.coordinates[0],
				latitude: point.geometry.coordinates[1],
				speed: speed,
				direction: direction,
			});
		}
		//轨迹的开始时间
		const t0 = points_[0].t;
		const traces = [];
		for (let index = 1; index < num; index++) {
			const startPoint = points_[index - 1];
			const endPoint = points_[index];
			const trace = new TraceInterpolation(startPoint, endPoint);
			traces.push(trace);
		}
		//根据插值时间计算对应插值轨迹段
		const getTraceByTime = (t) => {
			const index = points_.findIndex((point_) => {
				return point_.t > t;
			});
			return index === -1 ? undefined : traces[index - 1];
		};
		const interTracePointSource = new Cesium.CustomDataSource(
			"interTracePoint"
		);
		this.viewer.dataSources.add(interTracePointSource);
		this.viewer.clock.onTick.addEventListener((tick) => {
			const t = Cesium.JulianDate.toDate(tick.currentTime).getTime();
			const trace = getTraceByTime(t);
			if (!trace) {
				return;
			}
			const { latitude, longitude } = trace.getCoordinate(t);
			const diffT = 10;
			const { latitude: latitude_, longitude: longitude_ } =
				trace.getCoordinate(t - diffT);
			const bearing = turf.bearing(
				turf.point([longitude_, latitude_]),
				turf.point([longitude, latitude])
			);
			const heading = bearing < 0 ? bearing + 360 : bearing;
			const hpr = new Cesium.HeadingPitchRoll(
				Cesium.Math.toRadians(heading),
				0,
				0
			);
			const position = Cesium.Cartographic.fromDegrees(
				longitude,
				latitude
			);
			this.viewer.scene
				.sampleHeightMostDetailed(
					[position],
					[
						traceLine,
						...tracePointDataSource.entities.values,
						...interTracePointSource.entities.values,
					]
				)
				.then((value) => {
					const position_ = Cesium.Cartographic.toCartesian(value[0]);
					const qua = Cesium.Transforms.headingPitchRollQuaternion(
						position_,
						hpr,
						Cesium.Ellipsoid.WGS84,
						Cesium.Transforms.localFrameToFixedFrameGenerator(
							"north",
							"west"
						)
					);
					const entity = interTracePointSource.entities.add({
						position: position_,
						point: {
							pixelSize: 3,
							color: Cesium.Color.YELLOW,
						},
					});
				});
		});
		//更改cesium系统时间为轨迹开始时间
		this.viewer.clock.shouldAnimate = true;
		this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(
			new Date(t0)
		);
	}
}
export default new Map3D();
