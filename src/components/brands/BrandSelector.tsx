import React from 'react';
import { Check, HelpCircle, AlertTriangle } from 'lucide-react';
import { GasBrand, GAS_BRANDS, getBrandByCode, calculateExchangeFee } from '../../types/brands';

interface BrandSelectorProps {
  selectedBrand?: string;
  onBrandSelect: (brandCode: string) => void;
  originalBrand?: string;
  disabled?: boolean;
  showExchangeFees?: boolean;
  showGeneric?: boolean;
  required?: boolean;
  label?: string;
  error?: string;
  quantity?: number;
}

export const BrandSelector: React.FC<BrandSelectorProps> = ({
  selectedBrand,
  onBrandSelect,
  originalBrand,
  disabled = false,
  showExchangeFees = true,
  showGeneric = true,
  required = false,
  label = 'Select Brand',
  error,
  quantity = 1,
}) => {
  const availableBrands = GAS_BRANDS.filter(brand => 
    showGeneric || !brand.is_generic
  );

  const getExchangeFeeInfo = (brandCode: string) => {
    if (!originalBrand || !showExchangeFees) return null;
    
    const fee = calculateExchangeFee(originalBrand, brandCode, quantity);
    const isMatch = originalBrand === brandCode;
    const acceptedBrand = getBrandByCode(brandCode);
    
    return {
      fee,
      isMatch,
      isGeneric: acceptedBrand?.is_generic || false,
    };
  };

  const getBrandStatusIcon = (brandCode: string) => {
    if (!originalBrand) return null;
    
    const exchangeInfo = getExchangeFeeInfo(brandCode);
    if (!exchangeInfo) return null;
    
    if (exchangeInfo.isMatch) {
      return <Check className="h-4 w-4 text-green-600" />;
    } else if (exchangeInfo.isGeneric) {
      return <HelpCircle className="h-4 w-4 text-blue-600" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Original Brand Info */}
      {originalBrand && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Original Brand:</span>
            <div className="flex items-center space-x-2">
              <div 
                className="w-4 h-4 rounded-full border-2 border-gray-300"
                style={{ backgroundColor: getBrandByCode(originalBrand)?.color }}
              />
              <span className="font-medium">
                {getBrandByCode(originalBrand)?.name || originalBrand}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Brand Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {availableBrands.map((brand) => {
          const isSelected = selectedBrand === brand.code;
          const exchangeInfo = getExchangeFeeInfo(brand.code);
          const statusIcon = getBrandStatusIcon(brand.code);
          
          return (
            <button
              key={brand.id}
              type="button"
              disabled={disabled}
              onClick={() => onBrandSelect(brand.code)}
              className={`
                relative p-3 border rounded-lg text-left transition-all hover:shadow-md
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20' 
                  : 'border-gray-300 bg-white hover:border-gray-400'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}

              {/* Brand Info */}
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  {/* Brand Color */}
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: brand.color }}
                  />
                  
                  {/* Brand Name */}
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium ${brand.is_generic ? 'text-gray-600' : 'text-gray-900'}`}>
                      {brand.name}
                    </span>
                    {brand.is_generic && (
                      <span className="text-xs text-gray-500 ml-1">(Generic)</span>
                    )}
                  </div>

                  {/* Status Icon */}
                  {statusIcon}
                </div>

                {/* Brand Code */}
                <div className="text-xs text-gray-500 font-mono">
                  {brand.code}
                </div>

                {/* Exchange Fee Info */}
                {exchangeInfo && showExchangeFees && (
                  <div className="pt-2 border-t border-gray-200">
                    {exchangeInfo.isMatch ? (
                      <div className="text-xs text-green-600 font-medium">
                        ✓ No exchange fee
                      </div>
                    ) : exchangeInfo.isGeneric ? (
                      <div className="text-xs text-blue-600">
                        Generic acceptance (No fee)
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-700">
                        Exchange fee: {formatCurrency(exchangeInfo.fee)}
                        {quantity > 1 && (
                          <span className="text-gray-500">
                            {' '}({formatCurrency(exchangeInfo.fee / quantity)} each)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Exchange Fee Summary */}
      {selectedBrand && originalBrand && showExchangeFees && selectedBrand !== originalBrand && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-800">Cross-Brand Exchange</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Accepting {getBrandByCode(selectedBrand)?.name} cylinder instead of {getBrandByCode(originalBrand)?.name}.
                {(() => {
                  const fee = calculateExchangeFee(originalBrand, selectedBrand, quantity);
                  const acceptedBrand = getBrandByCode(selectedBrand);
                  
                  if (acceptedBrand?.is_generic) {
                    return ' Generic cylinder accepted with no additional fees.';
                  } else if (fee > 0) {
                    return ` Exchange fee of ${formatCurrency(fee)} will be applied.`;
                  } else {
                    return ' No exchange fee required.';
                  }
                })()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Helper Text */}
      <div className="text-xs text-gray-500 mt-2">
        Select the brand of the cylinder being returned. Exchange fees apply for cross-brand returns.
      </div>
    </div>
  );
};