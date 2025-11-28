import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Bell, BellOff, X } from 'lucide-react';

const PhoneInputOptional = ({ onPhoneChange }) => {
  const [phone, setPhone] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Cargar desde localStorage al montar
    const savedPhone = localStorage.getItem('wayrafrost_phone');
    if (savedPhone) {
      setPhone(savedPhone);
      setIsRegistered(true);
      onPhoneChange(savedPhone);
    }
  }, []);

  const validatePhone = (value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length === 9 && digits.startsWith('9');
  };

  const handleInputChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 9) value = value.slice(0, 9);
    setPhone(value);
    setError('');
  };

  const handleRegister = () => {
    if (!validatePhone(phone)) {
      setError('Ingrese un número válido de 9 dígitos que inicie con 9');
      return;
    }
    
    localStorage.setItem('wayrafrost_phone', phone);
    setIsRegistered(true);
    setIsEditing(false);
    onPhoneChange(phone);
  };

  const handleRemove = () => {
    localStorage.removeItem('wayrafrost_phone');
    setPhone('');
    setIsRegistered(false);
    setIsEditing(false);
    onPhoneChange(null);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    const savedPhone = localStorage.getItem('wayrafrost_phone');
    if (savedPhone) {
      setPhone(savedPhone);
    }
    setIsEditing(false);
    setError('');
  };

  // Estado registrado
  if (isRegistered && !isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-full">
            <Bell className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-medium text-emerald-800">Alertas SMS Activas</p>
            <p className="text-sm text-emerald-600">
              Recibirás alertas en <span className="font-mono font-bold">+51 {phone}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleEdit}
            className="px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Editar
          </motion.button>
          <motion.button
            onClick={handleRemove}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Desactivar alertas"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Estado sin registrar o editando
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 text-slate-700">
        <BellOff className="w-5 h-5 text-slate-400" />
        <span className="font-medium">Alertas SMS (opcional)</span>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <span className="text-slate-500 font-medium">+51</span>
          </div>
          <input
            type="tel"
            value={phone}
            onChange={handleInputChange}
            placeholder="987654321"
            maxLength="9"
            className={`w-full pl-14 pr-4 py-3 border rounded-xl text-lg focus:ring-2 focus:outline-none transition-all ${
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
            }`}
          />
        </div>
        
        <div className="flex gap-2">
          <motion.button
            onClick={handleRegister}
            disabled={!phone}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            whileHover={{ scale: phone ? 1.02 : 1 }}
            whileTap={{ scale: phone ? 0.98 : 1 }}
          >
            <Bell className="w-5 h-5" />
            Registrar
          </motion.button>
          
          {isEditing && (
            <motion.button
              onClick={handleCancel}
              className="px-4 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancelar
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-600 flex items-center gap-1"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      
      <p className="text-xs text-slate-500">
        Registra tu número para recibir alertas de heladas automáticamente. Es opcional.
      </p>
    </motion.div>
  );
};

export default PhoneInputOptional;
