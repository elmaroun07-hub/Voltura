import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Sun, Battery, MapPin, Euro, Leaf, Zap, 
  TrendingUp, Wind, Compass, Settings2, Home,
  TreePine, Lightbulb, ChevronRight
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from "recharts";

import "./_configurator.css";

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

const mixData = [
  { name: 'Solar', value: 86, color: '#10b981' }, // emerald-500
  { name: 'Grid', value: 14, color: '#334155' }, // slate-700
];

export function Configurator() {
  const [pvSize, setPvSize] = useState([4000]);
  const [batterySize, setBatterySize] = useState([10]);
  const [usage, setUsage] = useState([5000]);
  
  // Calculate panels to show based on PV size (approx 1 panel per 400W)
  const numPanels = Math.floor(pvSize[0] / 400);

  return (
    <div className="min-h-screen bg-[#020817] text-slate-50 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      
      {/* Header */}
      <header className="px-8 py-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#020817]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center">
            <Sun className="w-5 h-5 text-[#020817]" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Lumina Energy</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-400">
          <span className="text-white">1. Configure</span>
          <ChevronRight className="w-4 h-4 opacity-50" />
          <span>2. Summary</span>
          <ChevronRight className="w-4 h-4 opacity-50" />
          <span>3. Order</span>
        </div>
        <Button className="bg-white text-black hover:bg-slate-200 rounded-full px-6">
          Save Design
        </Button>
      </header>

      <main className="flex flex-col lg:flex-row h-[calc(100vh-85px)]">
        
        {/* Left: Visualization (55%) */}
        <div className="lg:w-[55%] relative bg-[#091124] overflow-hidden flex flex-col justify-center items-center">
          
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          
          {/* Glowing ambient light behind house */}
          <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

          {/* Visualization Canvas */}
          <div className="relative w-full max-w-2xl aspect-[4/3] z-10">
            {/* Base House Structure */}
            <svg viewBox="0 0 800 600" className="w-full h-full drop-shadow-2xl">
              {/* Sky / Sun */}
              <circle cx="650" cy="150" r="40" fill="#fde047" opacity="0.8" filter="blur(4px)" />
              
              {/* House Base */}
              <path d="M 200 350 L 600 350 L 600 550 L 200 550 Z" fill="#1e293b" stroke="#334155" strokeWidth="4" />
              {/* Garage */}
              <path d="M 50 400 L 200 400 L 200 550 L 50 550 Z" fill="#1e293b" stroke="#334155" strokeWidth="4" />
              
              {/* Roof main */}
              <path d="M 150 350 L 400 150 L 650 350 Z" fill="#0f172a" stroke="#475569" strokeWidth="4" />
              {/* Roof garage */}
              <path d="M 20 400 L 125 300 L 200 400 Z" fill="#0f172a" stroke="#475569" strokeWidth="4" />

              {/* Door */}
              <rect x="350" y="420" width="60" height="130" fill="#0f172a" rx="4" />
              {/* Windows */}
              <rect x="250" y="420" width="60" height="60" fill="#38bdf8" opacity="0.2" rx="4" />
              <rect x="450" y="420" width="100" height="60" fill="#38bdf8" opacity="0.2" rx="4" />
              
              {/* Garage Door */}
              <rect x="70" y="440" width="110" height="110" fill="#0f172a" rx="4" />

              {/* Battery Unit in Garage */}
              {batterySize[0] > 0 && (
                <g transform="translate(90, 480)" className="transition-all duration-500">
                  <rect x="0" y="0" width="30" height="60" fill="#10b981" rx="4" />
                  <rect x="4" y="4" width="22" height="12" fill="#020817" rx="2" />
                  <rect x="4" y="20" width="22" height="12" fill="#020817" rx="2" />
                  <circle cx="15" cy="45" r="4" fill="#020817" />
                  {/* Glowing line */}
                  <line x1="15" y1="52" x2="15" y2="70" stroke="#10b981" strokeWidth="2" strokeDasharray="2" />
                </g>
              )}

              {/* Solar Panels generated based on numPanels */}
              {/* We'll grid them on the main roof: center is X:400 Y:250 approx */}
              <g className="transition-all duration-700">
                {Array.from({ length: numPanels }).map((_, i) => {
                  const row = Math.floor(i / 5);
                  const col = i % 5;
                  // Calculate positions to fit on the roof triangle
                  const x = 300 + (col * 45);
                  const y = 220 + (row * 35);
                  return (
                    <g key={i} transform={`translate(${x}, ${y}) skewX(-20)`}>
                      <rect x="0" y="0" width="40" height="30" fill="#0ea5e9" opacity="0.8" rx="2" stroke="#bae6fd" strokeWidth="1" />
                      <line x1="10" y1="0" x2="10" y2="30" stroke="#bae6fd" strokeWidth="0.5" opacity="0.5" />
                      <line x1="20" y1="0" x2="20" y2="30" stroke="#bae6fd" strokeWidth="0.5" opacity="0.5" />
                      <line x1="30" y1="0" x2="30" y2="30" stroke="#bae6fd" strokeWidth="0.5" opacity="0.5" />
                      <line x1="0" y1="15" x2="40" y2="15" stroke="#bae6fd" strokeWidth="0.5" opacity="0.5" />
                    </g>
                  );
                })}
              </g>

            </svg>
          </div>

          {/* Environment Toggles (Visual) */}
          <div className="absolute bottom-8 left-8 flex gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 text-sm text-slate-300">
              <Sun className="w-4 h-4 text-yellow-400" />
              South Facing
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 text-sm text-slate-300">
              <Wind className="w-4 h-4 text-emerald-400" />
              35° Tilt
            </div>
          </div>
        </div>

        {/* Right: Controls (45%) */}
        <div className="lg:w-[45%] bg-[#020817] border-l border-white/10 flex flex-col h-full overflow-y-auto custom-scrollbar relative">
          
          <div className="p-8 lg:p-12 space-y-12 pb-48">
            <div>
              <h1 className="text-3xl lg:text-4xl font-light tracking-tight mb-2">Design Your System</h1>
              <p className="text-slate-400">Configure your solar and storage setup to see projected savings for your home.</p>
            </div>

            <div className="space-y-10">
              
              {/* Location & Usage */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-emerald-400 pb-2 border-b border-white/5">
                  <MapPin className="w-5 h-5" />
                  <h3 className="font-medium text-lg text-white">Home Profile</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Location</label>
                    <div className="bg-white/5 border border-white/10 rounded-md p-3 flex items-center gap-3">
                      <span className="text-sm font-medium">Berlin, Germany</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Current Tariff</label>
                    <div className="bg-white/5 border border-white/10 rounded-md p-3 flex items-center gap-3">
                      <span className="text-sm font-medium">€0.30 / kWh</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-300">Annual Energy Usage</label>
                    <span className="text-emerald-400 font-mono">{usage[0].toLocaleString()} kWh</span>
                  </div>
                  <Slider 
                    defaultValue={[5000]} 
                    max={15000} 
                    step={100} 
                    value={usage}
                    onValueChange={setUsage}
                    className="py-4 cursor-pointer" 
                  />
                  <div className="flex justify-between text-xs text-slate-500 font-mono">
                    <span>2,000</span>
                    <span>15,000+</span>
                  </div>
                </div>
              </section>

              {/* Hardware Config */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-emerald-400 pb-2 border-b border-white/5">
                  <Settings2 className="w-5 h-5" />
                  <h3 className="font-medium text-lg text-white">Hardware</h3>
                </div>

                {/* PV Size */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-slate-400" />
                      <label className="text-sm font-medium text-slate-300">Solar Array Size</label>
                    </div>
                    <span className="text-emerald-400 font-mono text-lg">{(pvSize[0] / 1000).toFixed(1)} kW</span>
                  </div>
                  <Slider 
                    defaultValue={[4000]} 
                    max={12000} 
                    step={400} 
                    value={pvSize}
                    onValueChange={setPvSize}
                    className="py-4 cursor-pointer" 
                  />
                  <p className="text-xs text-slate-500">Est. {numPanels} premium monocrystalline panels.</p>
                </div>

                {/* Battery Size */}
                <div className="space-y-4 pt-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Battery className="w-4 h-4 text-slate-400" />
                      <label className="text-sm font-medium text-slate-300">Powerwall Capacity</label>
                    </div>
                    <span className="text-emerald-400 font-mono text-lg">{batterySize[0]} kWh</span>
                  </div>
                  <Slider 
                    defaultValue={[10]} 
                    max={30} 
                    step={5} 
                    value={batterySize}
                    onValueChange={setBatterySize}
                    className="py-4 cursor-pointer" 
                  />
                  <p className="text-xs text-slate-500">Provides approx. {Math.round(batterySize[0] * 1.5)} hours of backup power.</p>
                </div>
              </section>

            </div>
          </div>

          {/* Sticky Summary Box at bottom of right column */}
          <div className="sticky bottom-0 left-0 right-0 bg-[#020817]/95 border-t border-white/10 backdrop-blur-xl p-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h4 className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Your System Spec</h4>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium">{(pvSize[0]/1000).toFixed(1)}kW Solar</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span className="font-medium">{batterySize[0]}kWh Storage</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Est. Cost</div>
                <div className="text-2xl font-light text-white font-mono">
                  €{(pvSize[0] * 1.2 + batterySize[0] * 600).toLocaleString()}
                </div>
              </div>
            </div>
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-[#020817] font-semibold h-12 text-lg rounded-md transition-colors">
              Request Detailed Quote
            </Button>
          </div>

        </div>
      </main>

      {/* Results Full Width Banner */}
      <section className="border-t border-white/10 bg-[#060d1d] relative z-10">
        <div className="max-w-[1600px] mx-auto p-8 lg:p-12">
          
          <h2 className="text-2xl font-light mb-8">Estimated Impact</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Metric Pills */}
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div className="bg-white/5 border border-white/5 rounded-xl p-5 hover:bg-white/10 transition-colors">
                <Euro className="w-6 h-6 text-emerald-400 mb-4" />
                <div className="text-3xl font-light font-mono mb-1">1,368</div>
                <div className="text-sm text-slate-400">Annual Savings</div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-5 hover:bg-white/10 transition-colors">
                <Zap className="w-6 h-6 text-blue-400 mb-4" />
                <div className="text-3xl font-light font-mono mb-1">4,276</div>
                <div className="text-sm text-slate-400">kWh Generated</div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-5 hover:bg-white/10 transition-colors">
                <Leaf className="w-6 h-6 text-green-400 mb-4" />
                <div className="text-3xl font-light font-mono mb-1">1,715</div>
                <div className="text-sm text-slate-400">kg CO₂ Avoided</div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-5 hover:bg-white/10 transition-colors">
                <TreePine className="w-6 h-6 text-emerald-500 mb-4" />
                <div className="text-3xl font-light font-mono mb-1">78</div>
                <div className="text-sm text-slate-400">Trees Equivalent</div>
              </div>

            </div>

            {/* Donut Chart Mini */}
            <div className="lg:col-span-4 bg-white/5 border border-white/5 rounded-xl p-5 flex items-center">
              <div className="w-1/2 h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixData}
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {mixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-3">
                <div className="text-sm text-slate-300 font-medium border-b border-white/10 pb-2 mb-3">Energy Independence</div>
                {mixData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                      <span className="text-slate-400">{d.name}</span>
                    </div>
                    <span className="font-mono">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Accordion for Monthly Chart */}
          <div className="mt-12">
            <Accordion type="single" collapsible className="border-white/10">
              <AccordionItem value="chart" className="border-white/10">
                <AccordionTrigger className="text-lg font-light hover:text-emerald-400 hover:no-underline">
                  View Monthly Generation Breakdown
                </AccordionTrigger>
                <AccordionContent className="pt-8">
                  <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis 
                          dataKey="name" 
                          stroke="#475569" 
                          fontSize={12} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#475569" 
                          fontSize={12} 
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip 
                          cursor={{fill: '#1e293b', opacity: 0.4}}
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc' }}
                          itemStyle={{ color: '#10b981' }}
                          formatter={(value) => [`${value} kWh`, 'Generated']}
                        />
                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40}>
                          {monthlyData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index > 3 && index < 9 ? '#10b981' : '#059669'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

        </div>
      </section>

    </div>
  );
}
