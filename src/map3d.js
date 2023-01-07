import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import { planeFit } from "./utils";
import * as turf from "@turf/turf";
import { getRotation } from "./utils";
window.turf = turf;

const getBoundingPoints = (lon, lat, dist) => {
    const pointN = turf.rhumbDestination(turf.point([lon, lat]), dist, 0, {
        units: "meters",
    }).geometry.coordinates;
    const pointE = turf.rhumbDestination(turf.point([lon, lat]), dist, 90, {
        units: "meters",
    }).geometry.coordinates;
    const pointS = turf.rhumbDestination(turf.point([lon, lat]), dist, 180, {
        units: "meters",
    }).geometry.coordinates;
    const pointW = turf.rhumbDestination(turf.point([lon, lat]), dist, -90, {
        units: "meters",
    }).geometry.coordinates;
    return [pointE, pointS, pointW, pointN];
};

class Map3D {
    initMap(container) {
        Cesium.Ion.defaultAccessToken = CesiumToken;
        this.viewer = new Cesium.Viewer(container, {
            geocoder: false, // 隐藏搜索
            homeButton: false, // 隐藏主页
            sceneModePicker: false, // 隐藏二三维转换
            baseLayerPicker: false, // 隐藏图层选择控件
            navigationHelpButton: false, // 隐藏帮助按钮
            animation: false, // 隐藏时钟
            timeline: false, // 隐藏时间轴
            fullscreenButton: true, // 隐藏全屏
            vrButton: false, // 隐藏双屏模式
            infoBox: false, // 隐藏点击 entity 信息框
            selectionIndicator: false, // 隐藏点击 entity 绿框
            shouldAnimate: true,
        });
        window.map3d = this;
        const tileset = this.viewer.scene.primitives.add(
            new Cesium.Cesium3DTileset({
                url: Cesium.IonResource.fromAssetId(57590),
            })
        );
        this.viewer.zoomTo(tileset);
        this.viewer.tracePointsSource = new Cesium.CustomDataSource(
            "tracePoints"
        );
        this.viewer.tracePoints = [];
        this.viewer.dataSources.add(this.viewer.tracePointsSource);
        this.viewer.screenSpaceEventHandler.setInputAction(
            (event) => {
                if (this.viewer.tracePoints.length === 0) {
                    this.viewer.tracePointsSource.entities.removeAll();
                    this.viewer.entities.removeById("traceLine");
                    this.viewer.entities.removeById("car");
                    this.viewer.cancelTick && this.viewer.cancelTick();
                }
                const point = this.viewer.scene.pickPosition(
                    event.position,
                    new Cesium.Cartesian3()
                );
                this.viewer.tracePointsSource.entities.add({
                    position: point,
                    point: {
                        color: Cesium.Color.RED,
                        pixelSize: 5,
                    },
                });
                this.viewer.tracePoints.push(point);
            },
            Cesium.ScreenSpaceEventType.LEFT_CLICK,
            Cesium.KeyboardEventModifier.CTRL
        );
        this.viewer.screenSpaceEventHandler.setInputAction(
            () => {
                this.viewer.entities.add({
                    id: "traceLine",
                    polyline: {
                        positions: this.viewer.tracePoints,
                        width: 3,
                        material: Cesium.Color.YELLOW,
                        clampToGround: true,
                    },
                });
                let tracePointsDirections = [];
                for (let i = 0; i < this.viewer.tracePoints.length; i++) {
                    if (i === this.viewer.tracePoints.length - 1) {
                        tracePointsDirections.push(
                            tracePointsDirections[
                                tracePointsDirections.length - 1
                            ]
                        );
                    } else {
                        tracePointsDirections.push(
                            Cesium.Cartesian3.normalize(
                                Cesium.Cartesian3.subtract(
                                    this.viewer.tracePoints[i + 1],
                                    this.viewer.tracePoints[i],
                                    new Cesium.Cartesian3()
                                ),
                                new Cesium.Cartesian3()
                            )
                        );
                    }
                }
                this.viewer.clock.shouldAnimate = false;
                const carPosition = new Cesium.SampledPositionProperty();
                const carDirections = new Cesium.SampledProperty(
                    Cesium.Cartesian3
                );
                let start = Cesium.JulianDate.fromDate(
                    new Date(),
                    new Cesium.JulianDate()
                );
                this.viewer.clock.currentTime = start;
                for (let i = 0; i < this.viewer.tracePoints.length; i++) {
                    const point = this.viewer.tracePoints[i];
                    carPosition.addSample(start, point);
                    carDirections.addSample(start, tracePointsDirections[i]);
                    start = Cesium.JulianDate.addSeconds(
                        start,
                        3,
                        new Cesium.JulianDate()
                    );
                }
                this.viewer.clock.stopTime = Cesium.JulianDate.addSeconds(
                    start,
                    -3,
                    new Cesium.JulianDate()
                );
                this.viewer.tracePoints = [];

                this.viewer.entities.add({
                    id: "car",
                    position: carPosition,
                    orientation: new Cesium.Quaternion(0, 0, 0, 1),
                    model: {
                        uri: "car.gltf",
                        scale: 5,
                    },
                });
                this.viewer.entities.add({
                    id: "car1",
                    position: new Cesium.Cartesian3(),
                    orientation: new Cesium.Quaternion(0, 0, 0, 1),
                    model: {
                        uri: "car.gltf",
                        scale: 5,
                    },
                });
                this.viewer.cancelTick =
                    this.viewer.clock.onTick.addEventListener(() => {
                        const carEntity = this.viewer.entities.getById("car");
                        const carPos = carEntity.position.getValue(
                            this.viewer.clock.currentTime
                        );
                        const carDirection = carDirections.getValue(
                            this.viewer.clock.currentTime
                        );
                        if (carPos) {
                            const carPos_ =
                                this.viewer.scene.clampToHeight(carPos);
                            const lon = Cesium.Math.toDegrees(
                                Cesium.Cartographic.fromCartesian(carPos_)
                                    .longitude
                            );
                            const lat = Cesium.Math.toDegrees(
                                Cesium.Cartographic.fromCartesian(carPos_)
                                    .latitude
                            );
                            const boundPoints = getBoundingPoints(
                                lon,
                                lat,
                                1.5
                            );
                            const boundPoints_ = boundPoints.map((point) => {
                                const point_ = Cesium.Cartesian3.fromDegrees(
                                    point[0],
                                    point[1]
                                );
                                const point__ =
                                    this.viewer.scene.clampToHeight(point_);
                                return [point__.x, point__.y, point__.z];
                            });
                            const [a, b, c] = planeFit(boundPoints_);
                            let zNormal = new Cesium.Cartesian3(a, b, c);
                            let flag = Cesium.Cartesian3.dot(zNormal, carPos_);
                            if (flag < 0) {
                                zNormal = new Cesium.Cartesian3(-a, -b, -c);
                            }
                            let yNormal = Cesium.Cartesian3.cross(
                                zNormal,
                                carDirection,
                                new Cesium.Cartesian3()
                            );
                            let xNormal = [
                                carDirection.x,
                                carDirection.y,
                                carDirection.z,
                            ];
                            yNormal = [yNormal.x, yNormal.y, yNormal.z];
                            zNormal = [zNormal.x, zNormal.y, zNormal.z];
                            const rotationValues = getRotation(
                                xNormal,
                                yNormal,
                                zNormal,
                                [1, 0, 0],
                                [0, 1, 0],
                                [0, 0, 1]
                            );
                            const rotationMatirx =
                                Cesium.Matrix3.fromArray(rotationValues);
                            const rotationQua =
                                Cesium.Quaternion.fromRotationMatrix(
                                    rotationMatirx,
                                    new Cesium.Quaternion()
                                );
                            const scale = new Cesium.Cartesian3(
                                carEntity.model.scale._value,
                                carEntity.model.scale._value,
                                carEntity.model.scale._value
                            );
                            const trs = new Cesium.TranslationRotationScale(
                                carPos_,
                                rotationQua,
                                scale
                            );
                            const modelMatrix =
                                Cesium.Matrix4.fromTranslationRotationScale(
                                    trs,
                                    new Cesium.Matrix4()
                                );
                            let x = this.viewer.entities.getById("car1");
                            x.position = carPos;
                            x.orientation = rotationQua;
                        }
                    }, this);
                this.viewer.clock.shouldAnimate = true;
            },
            Cesium.ScreenSpaceEventType.RIGHT_CLICK,
            Cesium.KeyboardEventModifier.CTRL
        );
    }
}
export default new Map3D();
