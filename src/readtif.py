from osgeo import gdal
from osgeo import gdalconst

gdal.AllRegister()
ds=gdal.Open("/Users/linchaoying/Desktop/HandSomeCesium/public/HeightMap_res1m_4326.tif",gdalconst.GA_ReadOnly)
print(gdal.Dataset.GetGeoTransform(ds))

(119.40963015669057, 9.778801492523904e-06, 0.0, 31.05982883083611, 0.0, -9.778801492523646e-06)
