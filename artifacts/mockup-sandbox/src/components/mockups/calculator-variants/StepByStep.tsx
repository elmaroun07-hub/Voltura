import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { MapPin, Sun, Battery, Euro, Leaf, TrendingUp, Zap, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Data
const monthlyData = [
  { name: 'Jan', value: 387 },
  { name: 'Feb', value: 349 },
  { name: 'Mar', value: 387 },
  { name: 'Apr', value: 374 },
  { name: 'May', value: 387 },
  { name: 'Jun', value: 374 },
  { name: 'Jul', value: 387 },
  { name: 'Aug', value: 387 },
  { name: 'Sep', value: 374 },
  { name: 'Oct', value: 387 },
  { name: 'Nov', value: 374 },
  { name: 'Dec', value: 387 },
];

const pieData = [
  { name: 'Solar', value: 86, color: '#22c55e' }, // green-500
  { name: 'Battery', value: 0, color: '#3b82f6' }, // blue-500
  { name: 'Grid', value: 14, color: '#94a3b8' }, // slate-400
];

export function StepByStep() {
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  
  const handleNext = () => setStep(s => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));
  
  const [location, setLocation] = useState('Berlin, Germany');
  const [usage, setUsage] = useState(5000);
  
  const [pvSize, setPvSize] = useState(4000);
  const [batteryCapacity, setBatteryCapacity] = useState(10);
  const [tilt, setTilt] = useState(35);
  const [orientation, setOrientation] = useState('South');
  
  const [tariff, setTariff] = useState(0.30);
  const [efficiency, setEfficiency] = useState(90);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
            <Leaf className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Green Energy Calculator</h1>
          <p className="text-slate-500 mt-2">Discover your savings potential in minutes</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm font-medium text-slate-500 mb-2">
            <span className={step >= 1 ? "text-green-600" : ""}>Location</span>
            <span className={step >= 2 ? "text-green-600" : ""}>System</span>
            <span className={step >= 3 ? "text-green-600" : ""}>Financial</span>
            <span className={step >= 4 ? "text-green-600" : ""}>Results</span>
          </div>
          <Progress value={(step / totalSteps) * 100} className="h-2 bg-slate-200" />
        </div>

        {/* Card Content */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
          <div className="p-8 sm:p-12 min-h-[400px] flex flex-col justify-center">
            
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-800">Where are you located?</h2>
                  <p className="text-slate-500 mt-2">Sunlight varies by region. Tell us where you live to calculate your solar potential.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="location" className="text-base">City or Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <Input 
                        id="location" 
                        value={location} 
                        onChange={e => setLocation(e.target.value)}
                        className="pl-10 h-12 text-lg"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label htmlFor="usage" className="text-base">Annual Energy Usage</Label>
                      <span className="font-semibold text-slate-700">{usage} kWh</span>
                    </div>
                    <Slider 
                      id="usage"
                      min={1000} 
                      max={20000} 
                      step={100} 
                      value={[usage]} 
                      onValueChange={(v) => setUsage(v[0])}
                      className="py-4"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-800">Design Your System</h2>
                  <p className="text-slate-500 mt-2">Customize your solar panels and battery storage.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-base flex items-center gap-2"><Sun className="w-4 h-4 text-orange-500"/> PV System Size</Label>
                      <span className="font-semibold text-slate-700">{pvSize} W</span>
                    </div>
                    <Slider min={1000} max={15000} step={500} value={[pvSize]} onValueChange={(v) => setPvSize(v[0])} />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-base flex items-center gap-2"><Battery className="w-4 h-4 text-blue-500"/> Battery Capacity</Label>
                      <span className="font-semibold text-slate-700">{batteryCapacity} kWh</span>
                    </div>
                    <Slider min={0} max={30} step={1} value={[batteryCapacity]} onValueChange={(v) => setBatteryCapacity(v[0])} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>Panel Tilt</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={tilt} onChange={e => setTilt(Number(e.target.value))} />
                        <span className="text-slate-500">°</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Orientation</Label>
                      <Select value={orientation} onValueChange={setOrientation}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="North">North</SelectItem>
                          <SelectItem value="South">South</SelectItem>
                          <SelectItem value="East">East</SelectItem>
                          <SelectItem value="West">West</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-800">Financial Settings</h2>
                  <p className="text-slate-500 mt-2">Help us calculate your exact savings.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-base flex items-center gap-2"><Euro className="w-4 h-4 text-green-600"/> Electricity Tariff</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-500">€</span>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={tariff} 
                        onChange={e => setTariff(Number(e.target.value))}
                        className="pl-8 h-12 text-lg"
                      />
                      <span className="absolute right-3 top-3 text-slate-500">/ kWh</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500"/> Battery Efficiency</Label>
                      <span className="font-semibold text-slate-700">{efficiency}%</span>
                    </div>
                    <Slider min={50} max={100} step={1} value={[efficiency]} onValueChange={(v) => setEfficiency(v[0])} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Results */}
            {step === 4 && (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center p-2 bg-green-100 rounded-full mb-3">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">Your Energy Future</h2>
                  <p className="text-slate-600 mt-2">Here is your estimated impact and savings.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="bg-green-50 border-green-100">
                    <CardContent className="p-4 text-center">
                      <div className="text-green-600 mb-1 flex justify-center"><Euro className="w-6 h-6" /></div>
                      <div className="text-2xl font-bold text-green-700">€1,368</div>
                      <div className="text-sm text-green-600 font-medium">Annual Savings</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="p-4 text-center">
                      <div className="text-blue-600 mb-1 flex justify-center"><Zap className="w-6 h-6" /></div>
                      <div className="text-2xl font-bold text-blue-700">4,276</div>
                      <div className="text-sm text-blue-600 font-medium">kWh Saved</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-50 border-emerald-100">
                    <CardContent className="p-4 text-center">
                      <div className="text-emerald-600 mb-1 flex justify-center"><Leaf className="w-6 h-6" /></div>
                      <div className="text-2xl font-bold text-emerald-700">1,715</div>
                      <div className="text-sm text-emerald-600 font-medium">kg CO₂ Reduced</div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <Card className="border shadow-sm">
                    <CardHeader className="p-4 pb-0">
                      <CardTitle className="text-sm font-medium text-slate-500">Energy Mix</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-3 text-xs mt-2">
                        {pieData.map(d => (
                          <div key={d.name} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                            <span className="text-slate-600">{d.name} ({d.value}%)</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border shadow-sm">
                    <CardHeader className="p-4 pb-0">
                      <CardTitle className="text-sm font-medium text-slate-500">Monthly Generation (kWh)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData}>
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{fill: '#f1f5f9'}} />
                          <Bar dataKey="value" fill="#22c55e" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm text-slate-600 text-center flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span>Your system will pay for itself in approximately <strong>6.5 years</strong>.</span>
                </div>
              </div>
            )}
            
          </div>

          {/* Footer Navigation */}
          <CardFooter className="px-8 py-6 bg-slate-50/50 border-t flex justify-between rounded-b-xl">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            ) : (
              <div></div> // Spacer
            )}
            
            {step < totalSteps ? (
              <Button onClick={handleNext} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={() => setStep(1)} variant="outline" className="gap-2">
                Recalculate
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
