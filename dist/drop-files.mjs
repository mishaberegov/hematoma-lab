export async function filesFromDrop(transfer){
  const items=Array.from(transfer.items||[]);
  const entries=items.map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
  if(!entries.some(entry=>entry.isDirectory))return Array.from(transfer.files||[]);
  const files=[];
  async function walk(entry){
    if(entry.isFile){
      files.push(await new Promise((resolve,reject)=>entry.file(resolve,reject)));
    }else if(entry.isDirectory){
      const reader=entry.createReader();
      while(true){
        const batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));
        if(!batch.length)break;
        for(const child of batch)await walk(child);
      }
    }
  }
  for(const entry of entries)await walk(entry);
  if(!files.length)throw Error('Перетащенная папка не содержит доступных DICOM-файлов или ZIP.');
  return files;
}
