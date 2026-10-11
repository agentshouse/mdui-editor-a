const assets=new Map();
export function registerBlobAsset(url,file){assets.set(url,file);}
export function getBlobAsset(url){return assets.get(url);}
export function clearBlobAssets(){for(const url of assets.keys())URL.revokeObjectURL(url);assets.clear();}

export function defaultImageTargetPath(file){return file.name;}
