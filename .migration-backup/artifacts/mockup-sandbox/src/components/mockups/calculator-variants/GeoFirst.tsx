import React, { useState } from "react";
import {
  MapPin,
  Sun,
  Battery,
  Euro,
  Leaf,
  TrendingUp,
  Zap,
  Wind,
  Search,
  Globe2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const monthlyData = [
  { name: "Jan", kwh: 387 },
  { name: "Feb", kwh: 349 },
  { name: "Mar", kwh: 387 },
  { name: "Apr", kwh: 374 },
  { name: "May", kwh: 387 },
  { name: "Jun", kwh: 374 },
  { name: "Jul", kwh: 387 },
  { name: "Aug", kwh: 387 },
  { name: "Sep", kwh: 374 },
  { name: "Oct", kwh: 387 },
  { name: "Nov", kwh: 374 },
  { name: "Dec", kwh: 387 },
];

const mixData = [
  { name: "Solar", value: 86, color: "#10b981" }, // emerald-500
  { name: "Grid", value: 14, color: "#f59e0b" },  // amber-500
  { name: "Battery", value: 0, color: "#3b82f6" }, // blue-500
];

export function GeoFirst() {
  const [pvOpen, setPvOpen] = useState(false);
  const [batteryOpen, setBatteryOpen] = useState(false);
  const [financialOpen, setFinancialOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 text-stone-900 font-sans pb-12">
      {/* Hero Section */}
      <div className="bg-stone-900 text-stone-50 pt-16 pb-24 px-6 md:px-12 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,50 Q25,30 50,50 T100,50 L100,100 L0,100 Z" fill="currentColor" />
          </svg>
        </div>
        
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="flex items-center gap-2 text-emerald-400 mb-6 font-medium tracking-wider uppercase text-sm">
            <Globe2 className="w-5 h-5" />
            <span>Geo-Climate Model</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">
            Anchor your energy <br />in geography.
          </h1>

          <div className="flex flex-col md:flex-row gap-4 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <Input 
                defaultValue="Berlin, Germany"
                className="w-full pl-12 pr-4 py-6 bg-stone-800/50 border-stone-700 text-lg rounded-2xl focus-visible:ring-emerald-500 placeholder:text-stone-500 text-stone-100 h-14"
              />
            </div>
            <Button className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg">
              Analyze
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <Badge variant="secondary" className="bg-stone-800/80 text-stone-300 hover:bg-stone-700 py-2 px-4 rounded-xl text-sm border-stone-700">
              🇩🇪 52.5°N 13.4°E
            </Badge>
            <Badge variant="secondary" className="bg-stone-800/80 text-emerald-400 hover:bg-stone-700 py-2 px-4 rounded-xl text-sm border-stone-700">
              <Sun className="w-4 h-4 mr-2 inline" />
              4.2 kWh/m²/day
            </Badge>
            <Badge variant="secondary" className="bg-stone-800/80 text-amber-400 hover:bg-stone-700 py-2 px-4 rounded-xl text-sm border-stone-700">
              <Wind className="w-4 h-4 mr-2 inline" />
              401 g/kWh CO₂
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 -mt-12 relative z-20">
        {/* Config Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {/* PV Config */}
          <Collapsible open={pvOpen} onOpenChange={setPvOpen} className="bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                  <Sun className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-stone-900">PV System</p>
                  <p className="text-sm text-stone-500">4000 W • South • 35°</p>
                </div>
              </div>
              {pvOpen ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-5 border-t border-stone-100 bg-stone-50/50 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>System Size (Watts)</Label>
                  <span className="text-sm font-medium">4000 W</span>
                </div>
                <Slider defaultValue={[4000]} max={10000} step={100} className="py-2" />
              </div>
              <div className="space-y-2">
                <Label>Orientation</Label>
                <Select defaultValue="south">
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select orientation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="north">North</SelectItem>
                    <SelectItem value="south">South</SelectItem>
                    <SelectItem value="east">East</SelectItem>
                    <SelectItem value="west">West</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Tilt Angle (°)</Label>
                  <span className="text-sm font-medium">35°</span>
                </div>
                <Slider defaultValue={[35]} max={90} step={1} className="py-2" />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Battery Config */}
          <Collapsible open={batteryOpen} onOpenChange={setBatteryOpen} className="bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Battery className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-stone-900">Storage</p>
                  <p className="text-sm text-stone-500">10 kWh • 90% Eff.</p>
                </div>
              </div>
              {batteryOpen ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-5 border-t border-stone-100 bg-stone-50/50 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Capacity (kWh)</Label>
                  <span className="text-sm font-medium">10 kWh</span>
                </div>
                <Slider defaultValue={[10]} max={30} step={1} className="py-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Efficiency (%)</Label>
                  <span className="text-sm font-medium">90%</span>
                </div>
                <Slider defaultValue={[90]} max={100} step={1} className="py-2" />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Financial Config */}
          <Collapsible open={financialOpen} onOpenChange={setFinancialOpen} className="bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                  <Euro className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-stone-900">Usage & Rates</p>
                  <p className="text-sm text-stone-500">5000 kWh • €0.30/kWh</p>
                </div>
              </div>
              {financialOpen ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-5 border-t border-stone-100 bg-stone-50/50 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Annual Usage (kWh)</Label>
                  <span className="text-sm font-medium">5000 kWh</span>
                </div>
                <Slider defaultValue={[5000]} max={15000} step={100} className="py-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Electricity Tariff (€/kWh)</Label>
                  <span className="text-sm font-medium">€0.30</span>
                </div>
                <Slider defaultValue={[0.30]} max={1.0} step={0.01} className="py-2" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Results Grid */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">Impact Projection</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-none shadow-md bg-emerald-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-emerald-100 font-medium text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Annual Energy Saved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">4,276 <span className="text-xl font-medium text-emerald-200">kWh</span></div>
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-stone-500 font-medium text-sm flex items-center gap-2">
                    <Euro className="w-4 h-4" />
                    Cost Savings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-stone-900">€1,368 <span className="text-xl font-medium text-stone-400">/year</span></div>
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-md bg-stone-900 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-stone-400 font-medium text-sm flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-emerald-400" />
                    CO₂ Reduction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-emerald-400">1,715 <span className="text-xl font-medium text-stone-400">kg</span></div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-none shadow-md col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>Monthly Generation</CardTitle>
                <CardDescription>Predicted solar output based on local climate data.</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f5f5f4' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="kwh" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>Energy Mix</CardTitle>
                <CardDescription>Where your power comes from.</CardDescription>
              </CardHeader>
              <CardContent className="h-72 flex flex-col items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {mixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-4">
                  <span className="text-3xl font-bold text-stone-900">86%</span>
                  <span className="text-sm text-stone-500 font-medium">Solar</span>
                </div>
                <div className="w-full flex justify-center gap-4 mt-2 mb-4">
                  {mixData.map(item => (
                    <div key={item.name} className="flex items-center gap-1.5 text-sm font-medium text-stone-600">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="border-none shadow-md bg-stone-50">
            <CardContent className="p-6 md:p-8 flex items-start gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-stone-900 mb-2">Recommendation for Berlin</h3>
                <p className="text-stone-600 leading-relaxed">
                  Based on your latitude (52.5°N) and local irradiance patterns, your 4000W south-facing setup is well-optimized. Your chosen 10kWh battery will significantly offset winter evening grid reliance, achieving 86% energy independence. This system has a projected payback period of approximately 6.5 years.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
