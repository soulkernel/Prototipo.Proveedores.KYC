export const IMAGE_LIMIT=200*1024;
export async function prepareSupplierImage(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('IMAGE_INVALID');
 const bitmap=await createImageBitmap(file);
 try{
  if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw Error('IMAGE_INVALID');
  const canvas=document.createElement('canvas'),ratio=Math.min(1,512/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.85,.7,.5,.3]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob?.type==='image/webp'&&blob.size<=IMAGE_LIMIT)return blob;}
  throw Error('IMAGE_INVALID');
 }finally{bitmap.close();}
}
export function liveSupplierImages(client){
 const bucket=client.storage.from('glf-supplier-images');
 async function unwrap(task){const {data,error}=await task;if(error)throw error;return data;}
 return {
  image:async path=>unwrap(bucket.download(path)),
  async setImage(row,blob){
   let path=null;
   if(blob){if(blob.type!=='image/webp'||blob.size>IMAGE_LIMIT||!blob.size)throw Error('IMAGE_INVALID');path=row.id+'/'+crypto.randomUUID()+'.webp';await unwrap(bucket.upload(path,blob,{contentType:'image/webp',cacheControl:'60',upsert:false}));}
   try{await unwrap(client.rpc('glf_set_supplier_image',{p_id:row.id,p_expected_version:row.version,p_path:path}));}
   catch(error){if(path)await bucket.remove([path]).catch(()=>{});throw error;}
   // Reference changes first. Failed cleanup never makes a valid image look unsaved.
   if(row.image_path)await bucket.remove([row.image_path]).catch(()=>{});
  }
 };
}
