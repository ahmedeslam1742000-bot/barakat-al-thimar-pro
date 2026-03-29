import React from 'react';
import { motion } from 'framer-motion';

export default function Placeholder({ title, icon: Icon }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-transparent text-slate-800 dark:text-slate-100 transition-colors duration-500 font-['Cairo'] p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800/80 dark:backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700/60 flex flex-col items-center max-w-md w-full text-center transition-colors duration-500"
      >
        <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 transition-colors">
          {Icon ? <Icon size={40} /> : <div className="text-4xl font-black">?</div>}
        </div>
        
        <h2 className="text-2xl font-black mb-3">{title}</h2>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          هذه الصفحة قيد التطوير وسيتم توفيرها قريباً.
        </p>
      </motion.div>
    </div>
  );
}
