const fs = require("fs");
const path = require("path");

fs.readFile(
	path.join(__dirname, "Trace.json"),
	{ encoding: "utf-8" },
    (error, data) => {
        if (error) { 
            console.log("文件读取失败！", error);
            return;
        }
        const traceData = JSON.parse(data);
        let t = Date.now();
        const tracePoints_ = traceData.features.map((point) => {
            const dt = (Math.random() * 0.4 + 0.8) * 1000;
            t += dt;
            const point_ = { ...point };
            point_.properties.t = t;
            return point_;
        });
        const traceData_ = {
            type: "FeatureCollection",
            features: tracePoints_
        };
        fs.writeFile(path.join(__dirname, "Trace_.json"), JSON.stringify(traceData_), (error) => { 
            if (error) {
                console.log("文件写入失败!");
            } else { 
                console.log("文件写入成功!");
            }
        });
    }
);
