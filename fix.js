const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Admin-Frontend', 'src', 'pages', 'admin', 'AddProduct.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr =               <button onClick={() => setIsTrending(!isTrending)}>
                {isTrending
                onChange={e => setManufacturerInfo(e.target.value)}
                placeholder="Manufacturer details, origin, etc." 
                className={\\ resize-none\} 
              />
            </div>
          </section>;

const correctStr =               <button onClick={() => setIsTrending(!isTrending)}>
                {isTrending
                  ? <ToggleRight size={28} className="text-blue-500" />
                  : <ToggleLeft size={28} className="text-slate-300" />
                }
              </button>
            </div>
          </section>

          {/* Tax & Compliance */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <SectionTitle icon={ShieldCheck} color="bg-green-50 text-green-600">Tax & Compliance</SectionTitle>

            <div>
              <Label>HSN Code</Label>
              <input 
                type="text" 
                value={hsnCode}
                onChange={e => setHsnCode(e.target.value)}
                placeholder="e.g. 4202" 
                className={inputCls} 
              />
            </div>
          </section>

          {/* Organization */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <SectionTitle icon={Tag} color="bg-amber-50 text-amber-500">Organization</SectionTitle>

            <div>
              <Label>Tags (Comma Separated)</Label>
              <input 
                type="text" 
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="new, trending, summer" 
                className={inputCls} 
              />
            </div>
            <div>
              <Label>Manufacturer Info</Label>
              <textarea 
                rows={3} 
                value={manufacturerInfo}
                onChange={e => setManufacturerInfo(e.target.value)}
                placeholder="Manufacturer details, origin, etc." 
                className={\\ resize-none\} 
              />
            </div>
          </section>;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, correctStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully fixed the file.");
} else {
    console.log("Target string not found.");
}
