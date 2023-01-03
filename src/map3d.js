import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import { planeFit } from "./utils";
import * as turf from "@turf/turf";
import { getRotation } from "./utils";
window.turf = turf;

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
                        tracePointsDirections.push(tracePointsDirections[tracePointsDirections.length - 1]);
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
                const carDirections = new Cesium.SampledProperty(Cesium.Cartesian3);
                let start = Cesium.JulianDate.fromDate(new Date(), new Cesium.JulianDate());
                this.viewer.clock.currentTime = start;
                for (let i = 0; i < this.viewer.tracePoints.length; i++) { 
                    const point = this.viewer.tracePoints[i];
                    carPosition.addSample(start, point);
                    carDirections.addSample(start, tracePointsDirections[i]);
                    start = Cesium.JulianDate.addSeconds(start, 3, new Cesium.JulianDate());
                }
                this.viewer.clock.stopTime = Cesium.JulianDate.addSeconds(
                    start,
                    -3,
                    new Cesium.JulianDate()
                );
                this.viewer.tracePoints = [];
                this.viewer.entities.add({
                    id: "car",
                    position:carPosition,
                    model: {
                        uri: "car.gltf",
                        scale: 5
                    }
                });
                this.viewer.cancelTick = this.viewer.clock.onTick.addEventListener(() => {
                    const carEntity = this.viewer.entities.getById("car");
                    const carPos = carEntity.position.getValue(this.viewer.clock.currentTime);
                    const carDirection = carDirections.getValue(this.viewer.clock.currentTime);
                    if (carPos) { 
                        const carPos_ = this.viewer.scene.clampToHeight(carPos);
                        
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
