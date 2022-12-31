import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";

class Map3D { 
    initMap(container) { 
        Cesium.Ion.defaultAccessToken = CesiumToken;
        this.viewer = new Cesium.Viewer(container, {
            timeline: false,
            animation:false,
            shouldAnimate: true
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