import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";

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
            terrainProvider: new Cesium.CesiumTerrainProvider({
                url: Cesium.IonResource.fromAssetId(1)
            })
        });
        // this.showAxis();
    }
    //绘制笛卡尔坐标系的三个轴
    showAxis(){
        //地球的平均半径是6378137m
        const radius=6500000;
        const zPoint=new Cesium.Cartesian3(0,0,radius);
        const yPoint=new Cesium.Cartesian3(0,radius,0);
        const xPoint=new Cesium.Cartesian3(radius,0,0);
        const axisDataSource=new Cesium.CustomDataSource("axis");
        this.viewer.dataSources.add(axisDataSource);
        axisDataSource.entities.add({
            id:"xAxis",
            position:xPoint,
            label:{
                text:'x'
            }
        });
        axisDataSource.entities.add({
            id:"yAxis",
            position:yPoint,
            label:{
                text:'y'
            }
        });
        axisDataSource.entities.add({
            id:"zAxis",
            position:zPoint,
            label:{
                text:'z'
            }
        });
    }
}
export default new Map3D();
