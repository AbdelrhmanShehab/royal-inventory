import { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  Trash2, 
  RotateCw,
  Database,
  Search,
  X
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Loader from '../../components/ui/Loader';
import { laundryApi } from '../../api/laundry.api';
import type { LaundryRecipe, LaundryRecipeItem, ChemicalItem } from '../../types/laundry';

export default function RecipesChemicals() {
  const [recipes, setRecipes] = useState<LaundryRecipe[]>([]);
  const [chemicals, setChemicals] = useState<ChemicalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [chemicalSearch, setChemicalSearch] = useState('');
  const [modalChemicalSearch, setModalChemicalSearch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<LaundryRecipe | null>(null);

  // Recipe Form
  const [recipeForm, setRecipeForm] = useState({
    recipeName: '',
    mode: 'STRICT' as 'STRICT' | 'FLEXIBLE' | 'MANUAL',
    description: '',
    isActive: true,
    items: [] as LaundryRecipeItem[]
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [rList, cList] = await Promise.all([
        laundryApi.getRecipes(),
        laundryApi.getChemicals()
      ]);
      setRecipes(rList || []);
      setChemicals(cList || []);
    } catch (err) {
      console.error('Error loading recipes/chemicals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isRecipeModalOpen) {
      setModalChemicalSearch('');
    }
  }, [isRecipeModalOpen]);

  const handleRecipeClick = async (rId: number) => {
    try {
      const detailed = await laundryApi.getRecipe(rId);
      setSelectedRecipe(detailed || null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipeForm.items.length === 0) {
      alert('يجب إضافة مادة كيميائية واحدة على الأقل في الوصفة.');
      return;
    }
    try {
      setSubmitting(true);
      await laundryApi.createRecipe({
        name: recipeForm.recipeName,
        mode: recipeForm.mode,
        description: recipeForm.description,
        isActive: recipeForm.isActive,
        items: recipeForm.items
      });
      setIsRecipeModalOpen(false);
      setRecipeForm({
        recipeName: '',
        mode: 'STRICT',
        description: '',
        isActive: true,
        items: []
      });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRecipe = async (rId: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الوصفة الكيميائية بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      await laundryApi.deleteRecipe(rId);
      setSelectedRecipe(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRecipeItem = (code: string, expected: number, min: number, max: number, mode: LaundryRecipeItem['calculationMode']) => {
    const chem = chemicals.find(c => c.itemCode === code);
    if (!chem) return;

    const newItem: LaundryRecipeItem = {
      chemicalItemCode: code,
      chemicalName: chem.itemNameAr || chem.itemNameEn,
      expectedQty: expected,
      minQty: min,
      maxQty: max,
      isRequired: true,
      calculationMode: mode
    };

    setRecipeForm(prev => {
      const exists = prev.items.some(i => i.chemicalItemCode === code);
      if (exists) {
        return {
          ...prev,
          items: prev.items.map(i => i.chemicalItemCode === code ? newItem : i)
        };
      }
      return {
        ...prev,
        items: [...prev.items, newItem]
      };
    });
  };

  const handleRemoveRecipeItem = (code: string) => {
    setRecipeForm(prev => ({
      ...prev,
      items: prev.items.filter(i => i.chemicalItemCode !== code)
    }));
  };

  const handleToggleClassification = async (itemCode: string, current: string | null) => {
    const nextClass = current === 'production' ? 'maintenance' : 'production';
    try {
      await laundryApi.classifyChemical(itemCode, nextClass);
      loadData();
    } catch (err) {
      console.error('Failed to change classification:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none text-right">
      
      {/* Header section */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <FlaskConical size={24} className="text-blue-600" />
            الوصفات والمواد الكيميائية
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            إدارة تراكيب ومعايير الحقن الكيميائي لغسيل المنسوجات، وتصنيف المواد الاستهلاكية المستوردة من COMSYS ERP.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RotateCw size={14} />
            تحديث
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsRecipeModalOpen(true)}>
            إضافة وصفة جديدة
          </Button>
        </div>
      </div>

      {/* Main Grid: Recipes list + Detailed Recipe drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recipes list (1 Col) */}
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-800">وصفات الغسيل الكيميائية</h2>
          {loading ? (
            <Loader size="sm" label="جاري تحميل وصفات الحقن..." />
          ) : recipes.length === 0 ? (
            <div className="bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-400 text-sm">
              لم يتم تعريف أي وصفة بالنظام حتى الآن.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recipes.map(r => (
                <div 
                  key={r.id}
                  onClick={() => handleRecipeClick(r.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all flex justify-between items-center bg-white shadow-2xs hover:shadow-xs ${
                    selectedRecipe?.id === r.id 
                      ? 'border-blue-600 ring-1 ring-blue-500/20' 
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold text-slate-800">{r.name}</span>
                    <span className="text-[10px] text-slate-450 mt-1 font-semibold">مستوى الحماية: {r.mode}</span>
                  </div>
                  <Badge variant={r.isActive ? 'success' : 'neutral'}>
                    {r.isActive ? 'نشطة' : 'معطلة'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Recipe detail (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-800">تفاصيل معايير وجرعات الوصفة الكيميائية</h2>
          <Card className="border-slate-200/60 shadow-2xs">
            <Card.Body className="p-4">
              {selectedRecipe ? (
                <div className="flex flex-col gap-5">
                  <div className="flex justify-between items-start bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <div className="flex flex-col">
                      <span className="text-base font-extrabold text-slate-800">{selectedRecipe.name}</span>
                      <span className="text-xs text-slate-450 mt-1">{selectedRecipe.description || 'لا يوجد وصف مضاف.'}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={selectedRecipe.mode === 'STRICT' ? 'danger' : selectedRecipe.mode === 'FLEXIBLE' ? 'warning' : 'info'}>
                        حقن {selectedRecipe.mode}
                      </Badge>
                      <button 
                        onClick={() => handleDeleteRecipe(selectedRecipe.id)}
                        className="p-1.5 rounded hover:bg-rose-50 text-rose-600 border border-transparent hover:border-rose-200 transition-colors"
                        title="حذف الوصفة"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-750">المكونات الكيميائية والجرعات المحددة (لكل 1 كجم غسيل):</span>
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-right border-collapse">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 font-bold text-slate-500">المادة الكيميائية</th>
                            <th className="px-3 py-2 text-center font-bold text-slate-500">الجرعة المحددة</th>
                            <th className="px-3 py-2 text-center font-bold text-slate-500">الحد الأدنى</th>
                            <th className="px-3 py-2 text-center font-bold text-slate-500">الحد الأقصى</th>
                            <th className="px-3 py-2 text-center font-bold text-slate-500">نمط الحساب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedRecipe.items && selectedRecipe.items.length > 0 ? (
                            selectedRecipe.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-3 py-3 font-bold text-slate-750">{item.chemicalName}</td>
                                <td className="px-3 py-3 text-center text-slate-700">{item.expectedQty} لتر</td>
                                <td className="px-3 py-3 text-center text-slate-500">{item.minQty} لتر</td>
                                <td className="px-3 py-3 text-center text-slate-500">{item.maxQty} لتر</td>
                                <td className="px-3 py-3 text-center text-slate-600">
                                  {item.calculationMode === 'chemical_per_kg' ? 'لكل 1 كجم' : 'حقن ثابت'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400">
                                لم يتم ربط مواد كيميائية في هذه الوصفة.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs">
                  اختر وصفة من القائمة لعرض تركيب الجرعات وتوزيع نسب الأمان ومعدلات الحساب.
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

      </div>

      {/* Chemicals stock status list */}
      {(() => {
        const filteredChemicals = chemicals.filter(chem =>
          chem.itemCode.toLowerCase().includes(chemicalSearch.toLowerCase()) ||
          (chem.itemNameAr || '').toLowerCase().includes(chemicalSearch.toLowerCase()) ||
          (chem.itemNameEn || '').toLowerCase().includes(chemicalSearch.toLowerCase())
        );
        const totalPages = Math.ceil(filteredChemicals.length / itemsPerPage);
        const indexOfLast = currentPage * itemsPerPage;
        const indexOfFirst = indexOfLast - itemsPerPage;
        const currentChemicals = filteredChemicals.slice(indexOfFirst, indexOfLast);

        return (
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Database size={18} className="text-blue-600" />
                تخزين وجرد المواد الكيميائية (مستوردة من COMSYS ERP)
              </h2>
              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  placeholder="ابحث بكود أو اسم المادة..."
                  value={chemicalSearch}
                  onChange={(e) => { setChemicalSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full pr-8 pl-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <span className="absolute right-2.5 top-2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
              </div>
            </div>
            <Card className="border-slate-200/60 shadow-2xs">
              <Card.Body className="p-0">
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 font-bold text-slate-500">كود الصنف</th>
                        <th className="px-5 py-3 font-bold text-slate-500">اسم المادة الكيميائية (عربي)</th>
                        <th className="px-5 py-3 font-bold text-slate-500">الاسم بالإنجليزية</th>
                        <th className="px-5 py-3 font-bold text-slate-500 text-center">نوع الاستخدام والتصنيف</th>
                        <th className="px-5 py-3 font-bold text-slate-500 text-center">تعديل التصنيف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">جاري تحميل أصناف المخازن...</td>
                        </tr>
                      ) : currentChemicals.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">لا توجد مواد كيميائية مطابقة للبحث.</td>
                        </tr>
                      ) : (
                        currentChemicals.map((chem, idx) => (
                          <tr key={`${chem.itemCode}-${idx}`} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3 font-mono font-semibold text-slate-500">{chem.itemCode}</td>
                            <td className="px-5 py-3 font-bold text-slate-700">{chem.itemNameAr}</td>
                            <td className="px-5 py-3 text-slate-500">{chem.itemNameEn}</td>
                            <td className="px-5 py-3 text-center">
                              <Badge variant={chem.chemicalClassification === 'production' ? 'info' : 'warning'}>
                                {chem.chemicalClassification === 'production' ? 'إنتاج تشغيلي' : 'صيانة وتنظيف مقرات'}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <button
                                onClick={() => handleToggleClassification(chem.itemCode, chem.chemicalClassification)}
                                className="px-2.5 py-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 border border-blue-200 rounded bg-blue-50/45 cursor-pointer"
                              >
                                تغيير التصنيف
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center bg-white border border-slate-200/80 px-6 py-3.5 rounded-xl shadow-xs select-none">
                <span className="text-xs text-slate-400 font-bold">
                  عرض {indexOfFirst + 1} - {Math.min(indexOfLast, filteredChemicals.length)} من أصل {filteredChemicals.length} مادة
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    السابق
                  </Button>
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === idx + 1
                          ? 'bg-blue-600 text-white'
                          : 'bg-transparent text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* CREATE RECIPE MODAL */}
      <Modal isOpen={isRecipeModalOpen} onClose={() => setIsRecipeModalOpen(false)} title="إضافة وصفة كيميائية جديدة" size="lg">
        <form onSubmit={handleCreateRecipe} className="flex flex-col gap-4 font-arabic">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="اسم الوصفة"
              placeholder="مثال: وصفة المفارش والبياضات القياسية"
              required
              value={recipeForm.recipeName}
              onChange={(e) => setRecipeForm({ ...recipeForm, recipeName: e.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">مستوى أمان الدوزنة (Mode)</label>
              <select
                value={recipeForm.mode}
                onChange={(e) => setRecipeForm({ ...recipeForm, mode: e.target.value as any })}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
              >
                <option value="STRICT">STRICT (أمان عالي - لا يسمح بتعديل الجرعة)</option>
                <option value="FLEXIBLE">FLEXIBLE (مرن - يسمح بتعديل الجرعة ضمن هوامش محددة)</option>
                <option value="MANUAL">MANUAL (يدوي كلي للمشغل)</option>
              </select>
            </div>
          </div>

          <Input
            label="ملاحظات وتفاصيل الدورة الكيميائية"
            placeholder="مثال: تراكيب صابون ديتول سائل ومبيض ومطهر"
            value={recipeForm.description}
            onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })}
          />

          {/* Recipe Items Picker */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-bold text-slate-700">إضافة مكونات الوصفة والجرعات التشغيلية:</span>
            
            <div className="flex flex-col md:flex-row gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 items-end">
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500">اختر المادة الكيميائية</span>
                <div className="relative mb-1">
                  <input
                    type="text"
                    placeholder="ابحث لفلترة المواد التشغيلية..."
                    value={modalChemicalSearch}
                    onChange={(e) => setModalChemicalSearch(e.target.value)}
                    className="w-full pr-7 pl-7 py-1 bg-white border border-slate-200 rounded text-[10px] focus:outline-none focus:border-blue-500"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Search size={11} />
                  </span>
                  {modalChemicalSearch && (
                    <button
                      type="button"
                      onClick={() => setModalChemicalSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 focus:outline-none cursor-pointer flex items-center justify-center"
                      title="مسح البحث"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <select
                  id="recipe-chem-picker"
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                >
                  {chemicals
                    .filter(c =>
                      (c.itemNameAr || '').toLowerCase().includes(modalChemicalSearch.toLowerCase()) ||
                      c.itemCode.toLowerCase().includes(modalChemicalSearch.toLowerCase())
                    )
                    .map((c, idx) => (
                      <option key={`${c.itemCode}-${idx}`} value={c.itemCode}>{c.itemNameAr}</option>
                    ))}
                </select>
              </div>

              <div className="w-18 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500">الجرعة</span>
                <input
                  type="number"
                  id="recipe-chem-expected"
                  step="0.01"
                  defaultValue={0.5}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                />
              </div>

              <div className="w-18 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500">الأدنى</span>
                <input
                  type="number"
                  id="recipe-chem-min"
                  step="0.01"
                  defaultValue={0.4}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                />
              </div>

              <div className="w-18 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500">الأقصى</span>
                <input
                  type="number"
                  id="recipe-chem-max"
                  step="0.01"
                  defaultValue={0.6}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                />
              </div>

              <div className="w-24 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500">نمط الحساب</span>
                <select
                  id="recipe-chem-mode"
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                >
                  <option value="chemical_per_kg">لكل 1 كجم</option>
                  <option value="fixed_consumption">جرعة ثابتة</option>
                </select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const pickerEl = document.getElementById('recipe-chem-picker') as HTMLSelectElement;
                  const expEl = document.getElementById('recipe-chem-expected') as HTMLInputElement;
                  const minEl = document.getElementById('recipe-chem-min') as HTMLInputElement;
                  const maxEl = document.getElementById('recipe-chem-max') as HTMLInputElement;
                  const modeEl = document.getElementById('recipe-chem-mode') as HTMLSelectElement;

                  if (pickerEl && expEl && minEl && maxEl && modeEl) {
                    handleAddRecipeItem(
                      pickerEl.value,
                      Number(expEl.value),
                      Number(minEl.value),
                      Number(maxEl.value),
                      modeEl.value as any
                    );
                    setModalChemicalSearch(''); // Clear search on add!
                  }
                }}
                className="py-1.5 px-3"
              >
                إضافة
              </Button>
            </div>

            {/* Added Items table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs mt-2 max-h-48 overflow-y-auto">
              {recipeForm.items.length === 0 ? (
                <div className="p-4 text-center text-slate-400">لم يتم إدخال مكونات بعد.</div>
              ) : (
                recipeForm.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 bg-white hover:bg-slate-50">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-750">{item.chemicalName}</span>
                      <span className="text-[9px] text-slate-400 font-semibold">{item.calculationMode === 'chemical_per_kg' ? 'حساب لكل كجم' : 'جرعة ثابتة'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-2 text-slate-500 font-bold">
                        <span>الجرعة: {item.expectedQty}ل</span>
                        <span>[أدنى: {item.minQty}ل / أقصى: {item.maxQty}ل]</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeItem(item.chemicalItemCode)}
                        className="text-rose-600 hover:text-rose-800 font-bold"
                      >
                        إزالة
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsRecipeModalOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary" isLoading={submitting}>حفظ الوصفة</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
