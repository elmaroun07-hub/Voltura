import React, { useState } from "react";
import { 
  Sun, 
  Battery, 
  MapPin, 
  Euro, 
  Leaf, 
  TrendingUp, 
  Zap, 
  Wind,
  Settings,
  RefreshCw
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer 
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DataFirst() {
  const [isCalculating, setIsCalculating] = useState(false);

  const handleRecalculate = () => {
    setIsCalculating(true);
    setTimeout(() => setIsCalculating(false), 600);
  };

  const monthlyData = [
    { name: "Jan", value: 387 },
    { name: "Feb", value: 349 },
    { name: "Mar", value: 387 },
    { name: "Apr", value: 374 },
    { name: "May", value: 387 },
    { name: "Jun", value: 374 },
    { name: "Jul", value: 387 },
    { name: "Aug", value: 387 },
    { name: "Sep", value: 374 },
    { name: "Oct", value: 387 },
    { name: "Nov", value: 374 },
    { name: "Dec", value: 387 },
  ];

  const pieData = [
    { name: "Solar", value: 86, color: "#10b981" },
    { name: "Battery", value: 0, color: "#3b82f6" },
    { name: "Grid", value: 14, color: "#f43f5e" },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-slate-50 font-sans text-slate-900">
      {/* Sidebar Inputs */}
      <aside className="w-full md:w-[320px] bg-slate-950 text-slate-200 p-6 flex flex-col h-auto md:h-screen sticky top-0 overflow-y-auto shrink-0 border-r border-slate-800">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-md bg-emerald-500 flex items-center justify-center">
            <Sun className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-white">GreenYield</h1>
        </div>

        <div className="space-y-6 flex-1">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Location & Usage</h3>
            
            <div className="space-y-2">
              <Label htmlFor="location" className="text-slate-300 text-xs">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input 
                  id="location" 
                  defaultValue="Berlin, Germany" 
                  className="bg-slate-900 border-slate-800 text-slate-200 pl-9 focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="usage" className="text-slate-300 text-xs">Annual Usage</Label>
                <span className="text-xs text-emerald-400 font-mono">5,000 kWh</span>
              </div>
              <Slider defaultValue={[5000]} max={20000} step={100} className="py-2" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tariff" className="text-slate-300 text-xs">Electricity Tariff</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input 
                  id="tariff" 
                  defaultValue="0.30" 
                  className="bg-slate-900 border-slate-800 text-slate-200 pl-9 focus-visible:ring-emerald-500"
                />
                <div className="absolute right-3 top-2.5 text-xs text-slate-500">/ kWh</div>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-800 w-full" />

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">System Specs</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="pv" className="text-slate-300 text-xs">PV System Size</Label>
                <span className="text-xs text-emerald-400 font-mono">4,000 W</span>
              </div>
              <Slider defaultValue={[4000]} max={15000} step={100} className="py-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="battery" className="text-slate-300 text-xs">Battery Capacity</Label>
                <span className="text-xs text-emerald-400 font-mono">10 kWh</span>
              </div>
              <Slider defaultValue={[10]} max={30} step={1} className="py-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tilt" className="text-slate-300 text-xs">Tilt Angle</Label>
                <Input 
                  id="tilt" 
                  defaultValue="35" 
                  className="bg-slate-900 border-slate-800 text-slate-200 focus-visible:ring-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orientation" className="text-slate-300 text-xs">Orientation</Label>
                <Select defaultValue="s">
                  <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200 focus-visible:ring-emerald-500">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="n">North</SelectItem>
                    <SelectItem value="s">South</SelectItem>
                    <SelectItem value="e">East</SelectItem>
                    <SelectItem value="w">West</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="efficiency" className="text-slate-300 text-xs">Battery Efficiency</Label>
                <span className="text-xs text-emerald-400 font-mono">90%</span>
              </div>
              <Slider defaultValue={[90]} max={100} step={1} className="py-2" />
            </div>
          </div>
        </div>

        <Button 
          className="w-full mt-8 bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
          onClick={handleRecalculate}
          disabled={isCalculating}
        >
          {isCalculating ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          Recalculate Yield
        </Button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Yield Forecast</h2>
              <p className="text-slate-500 text-sm mt-1">Based on historic weather data and specified parameters.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              Live Model Active
            </div>
          </header>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Annual Energy Saved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tighter text-slate-900">4,276</span>
                  <span className="text-sm font-medium text-slate-500">kWh</span>
                </div>
                <div className="mt-2 flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +85% of total usage
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Euro className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Annual Cost Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-medium text-slate-500">€</span>
                  <span className="text-4xl font-bold tracking-tighter text-slate-900">1,368</span>
                </div>
                <div className="mt-2 flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                  Payback in ~7.2 years
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Leaf className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">CO₂ Reduction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tighter text-slate-900">1,715</span>
                  <span className="text-sm font-medium text-slate-500">kg</span>
                </div>
                <div className="mt-2 flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                  Equivalent to 78 trees planted
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Bar Chart */}
            <Card className="border-slate-200 shadow-sm bg-white lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Monthly Generation</CardTitle>
                <CardDescription>Estimated solar energy generated per month (kWh)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <RechartsTooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Donut & Recommendations */}
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base font-semibold text-slate-800">Energy Mix</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center">
                  <div className="h-[180px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-slate-900">86%</span>
                      <span className="text-[10px] uppercase text-slate-500 font-medium">Autarky</span>
                    </div>
                  </div>
                  <div className="flex gap-4 w-full justify-center text-xs mt-2">
                    {pieData.map(item => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-slate-600">{item.name}</span>
                        <span className="font-medium text-slate-900">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-100 bg-emerald-50/50 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-600" />
                    Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    A <strong className="font-semibold text-emerald-950">4kW PV system</strong> with a <strong className="font-semibold text-emerald-950">10kWh battery</strong> covers most of your usage. Consider slightly increasing PV size if you plan to add an EV or heat pump.
                  </p>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
