import React, { useState, useEffect } from 'react';
import { Phone, Check, AlertCircle } from 'lucide-react';

const PhoneInput = ({ onPhoneChange, initialPhone = "" }) => {
  const [phone, setPhone] = useState(initialPhone);
  const [isValid, setIsValid] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    // Cargar desde localStorage al montar
    const savedPhone = localStorage.getItem('wayrafrost_phone');
    if (savedPhone) {
      setPhone(savedPhone);
      validatePhone(savedPhone);
    }
  }, []);

  const validatePhone = (value) => {
    // Solo dígitos, debe tener 9 caracteres
    const digits = value.replace(/\D/g, '');
    const valid = digits.length === 9 && digits.startsWith('9');
    setIsValid(valid);
    return valid;
  };

  const handleChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Solo números
    
    // Limitar a 9 dígitos
    if (value.length > 9) {
      value = value.slice(0, 9);
    }
    
    setPhone(value);
    const valid = validatePhone(value);
    
    // Guardar en localStorage
    if (valid) {
      localStorage.setItem('wayrafrost_phone', value);
      onPhoneChange(value);
    } else {
      localStorage.removeItem('wayrafrost_phone');
      onPhoneChange(null);
    }
  };

  const handleBlur = () => {
    setTouched(true);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        <Phone className="w-4 h-4 inline mr-1" />
        Número de teléfono para alertas SMS
      </label>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <span className="text-gray-500 text-sm">+51</span>
        </div>
        
        <input
          type="tel"
          value={phone}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="987654321"
          maxLength="9"
          className={`block w-full pl-12 pr-10 py-3 border rounded-lg text-lg focus:ring-2 focus:outline-none ${
            touched && phone
              ? isValid
                ? 'border-green-300 focus:border-green-500 focus:ring-green-200'
                : 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
          }`}
        />
        
        {phone && touched && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isValid ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
        )}
      </div>
      
      {touched && phone && !isValid && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          Ingrese un número celular válido de 9 dígitos que inicie con 9
        </p>
      )}
      
      {isValid && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <Check className="w-4 h-4" />
          Recibirás alertas en +51 {phone}
        </p>
      )}
      
      <p className="text-xs text-gray-500">
        El número se guardará en tu navegador y recibirás un SMS con el resultado del análisis
      </p>
    </div>
  );
};

export default PhoneInput;
