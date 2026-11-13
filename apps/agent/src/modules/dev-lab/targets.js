export function targetDevice(device,platform=process.platform){
 if(!device||device.state!=='online')throw Error('Choose an online device');
 if(device.platform!=='android'&&!(device.platform==='ios'&&device.group==='ios'&&platform==='darwin'))throw Error('Use Android or an iOS Simulator on macOS');
 const connection=device.platform==='android'?(device.flutterId||device.serial):device.id;
 if(typeof connection!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:%\[\]-]{0,200}$/.test(connection))throw Error('Invalid device connection. Refresh devices');
 return {...device,connection};
}
