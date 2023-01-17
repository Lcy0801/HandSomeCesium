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
	}
	
}
export default new Map3D();