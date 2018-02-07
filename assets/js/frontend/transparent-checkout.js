/*global wc_pagseguro_params, PagSeguroDirectPayment, wc_checkout_params */
(function( $ ) {
	'use strict';

	$( function() {

		var pagseguro_submit = false;
                
                function pagSeguroRound(number, precision) {
                    var factor = Math.pow(10, precision);
                    var tempNumber = number * factor;
                    var roundedTempNumber = Math.round(tempNumber);
                    return roundedTempNumber / factor;
                };
                
                function calculaDesconto(){
                    var $ = jQuery;
                    var method = $('input[name=pagseguro_payment_method]:checked').val();
                    var instalments = $('#pagseguro-card-installments option:selected').val();
                    var amount = $( 'body #pagseguro-payment-form' ).data( 'cart_total' );
                    var desconto = false;
                    var desconto_valor = 0.00;
                    var price_off = $('input[name=pagseguro_price_off]').val();

                    if (method === 'bank-transfer' || method === 'banking-ticket'){
                        desconto = true;
                    } else if (method === 'credit-card' && instalments === '1'){
                        desconto = true;
                    }

                    if (desconto){
                        var desconto_valor = pagSeguroRound(amount * (price_off / 100), 2);
                    }
                    
                    amount = pagSeguroRound(amount - desconto_valor, 2);

                    $('input[name=pagseguro_desconto]').val(desconto_valor);
                    $('input[name=pagseguro_valor_final]').val(amount);

                    $('#discount-amount-pagseguro').text(pagSeguroGetPriceTextWithoutCurrency(desconto_valor));
                    $('tr.order-total td span.amount').contents().each(function() {
                        if (this.nodeType === 3) {
                            this.textContent
                            ? this.textContent = pagSeguroGetPriceTextWithoutCurrency(amount)
                            : this.innerText  = pagSeguroGetPriceTextWithoutCurrency(amount);
                        }
                    });
                }

                function getValorComDesconto() {
                    var amount = jQuery( 'body #pagseguro-payment-form' ).data( 'cart_total' );
                    return amount * 0.85;
                }

		/**
		 * Set credit card brand.
		 *
		 * @param {string} brand
		 */
		function pagSeguroSetCreditCardBrand( brand ) {
			$( '#pagseguro-credit-card-form' ).attr( 'data-credit-card-brand', brand );
		}

		/**
		 * Format price.
		 *
		 * @param  {int|float} price
		 *
		 * @return {string}
		 */
		function pagSeguroGetPriceText( price ) {
			return 'R$ ' + pagSeguroGetPriceTextWithoutCurrency( price );
		}
                
                function pagSeguroGetPriceTextWithoutCurrency( price ) {
                        return parseFloat( price, 10 ).toFixed( 2 ).replace( '.', ',' ).toString();
                } 

		/**
		 * Get installment option.
		 *
		 * @param  {object} installment
		 *
		 * @return {string}
		 */
		function pagSeguroGetInstallmentOption( installment ) {
			var interestFree = ( true === installment.interestFree ) ? ' ' + wc_pagseguro_params.interest_free : '';

			return '<option value="' + installment.quantity + '" data-installment-value="' + installment.installmentAmount + '">' + installment.quantity + 'x ' + pagSeguroGetPriceText( installment.installmentAmount ) + interestFree + '</option>';
		}

		/**
		 * Add error message
		 *
		 * @param {string} error
		 */
		function pagSeguroAddErrorMessage( error ) {
			var wrapper = $( '#pagseguro-credit-card-form' );

			$( '.woocommerce-error', wrapper ).remove();
			wrapper.prepend( '<div class="woocommerce-error" style="margin-bottom: 0.5em !important;">' + error + '</div>' );
		}

		/**
		 * Hide payment methods if have only one.
		 */
		function pagSeguroHidePaymentMethods() {
			var paymentMethods = $( '#pagseguro-payment-methods' );

			if ( 1 === $( 'input[type=radio]', paymentMethods ).length ) {
				paymentMethods.hide();
			}
		}

		/**
		 * Show/hide the method form.
		 *
		 * @param {string} method
		 */
		function pagSeguroShowHideMethodForm( method ) {
			// window.alert( method );
			$( '.pagseguro-method-form' ).hide();
			$( '#pagseguro-payment-methods li' ).removeClass( 'active' );
			$( '#pagseguro-' + method + '-form' ).show();
			$( '#pagseguro-payment-method-' + method ).parent( 'label' ).parent( 'li' ).addClass( 'active' );
		}

		/**
		 * Initialize the payment form.
		 */
		function pagSeguroInitPaymentForm() {
			pagSeguroHidePaymentMethods();

			$( '#pagseguro-payment-form' ).show();

			pagSeguroShowHideMethodForm( $( '#pagseguro-payment-methods input[type=radio]:checked' ).val() );

			// CPF.
			$( '#pagseguro-card-holder-cpf' ).mask( '000.000.000-00' );

			// Birth Date.
			$( '#pagseguro-card-holder-birth-date' ).mask( '00/00/0000' );

			// Phone.
			var MaskBehavior = function( val ) {
					return val.replace( /\D/g, '' ).length === 11 ? '(00) 00000-0000' : '(00) 0000-00009';
				},
				maskOptions = {
					onKeyPress: function( val, e, field, options ) {
						field.mask( MaskBehavior.apply( {}, arguments ), options );
					}
				};

			$( '#pagseguro-card-holder-phone' ).mask( MaskBehavior, maskOptions );

			$( '#pagseguro-bank-transfer-form input[type=radio]:checked' ).parent( 'label' ).parent( 'li' ).addClass( 'active' );
		}

		/**
		 * Form Handler.
		 *
		 * @return {bool}
		 */
		function pagSeguroformHandler() {
			if ( pagseguro_submit ) {
				pagseguro_submit = false;

				return true;
			}

			if ( ! $( '#payment_method_pagseguro' ).is( ':checked' ) ) {
				return true;
			}

			if ( 'credit-card' !== $( 'body li.payment_method_pagseguro input[name=pagseguro_payment_method]:checked' ).val() ) {
				$( 'form.checkout, form#order_review' ).append( $( '<input name="pagseguro_sender_hash" type="hidden" />' ).val( PagSeguroDirectPayment.getSenderHash() ) );

				return true;
			}

			var form = $( 'form.checkout, form#order_review' ),
				creditCardForm  = $( '#pagseguro-credit-card-form', form ),
				error           = false,
				errorHtml       = '',
				brand           = creditCardForm.attr( 'data-credit-card-brand' ),
				cardNumber      = $( '#pagseguro-card-number', form ).val().replace( /[^\d]/g, '' ),
				cvv             = $( '#pagseguro-card-cvc', form ).val(),
				expirationMonth = $( '#pagseguro-card-expiry', form ).val().replace( /[^\d]/g, '' ).substr( 0, 2 ),
				expirationYear  = $( '#pagseguro-card-expiry', form ).val().replace( /[^\d]/g, '' ).substr( 2 ),
				installments    = $( '#pagseguro-card-installments', form ),
				today           = new Date();

			// Validate the credit card data.
			errorHtml += '<ul>';

			// Validate the card brand.
			if ( typeof brand === 'undefined' || 'error' === brand ) {
				errorHtml += '<li>' + wc_pagseguro_params.invalid_card + '</li>';
				error = true;
			}

			// Validate the expiry date.
			if ( 2 !== expirationMonth.length || 4 !== expirationYear.length ) {
				errorHtml += '<li>' + wc_pagseguro_params.invalid_expiry + '</li>';
				error = true;
			}

			if ( ( 2 === expirationMonth.length && 4 === expirationYear.length ) && ( expirationMonth > 12 || expirationYear <= ( today.getFullYear() - 1 ) || expirationYear >= ( today.getFullYear() + 20 ) || ( expirationMonth < ( today.getMonth() + 2 ) && expirationYear.toString() === today.getFullYear().toString() ) ) ) {
				errorHtml += '<li>' + wc_pagseguro_params.expired_date + '</li>';
				error = true;
			}

			// Installments.
			if ( '0' === installments.val() ) {
				errorHtml += '<li>' + wc_pagseguro_params.empty_installments + '</li>';
				error = true;
			}

			errorHtml += '</ul>';

			// Create the card token.
			if ( ! error ) {
				PagSeguroDirectPayment.createCardToken({
					brand:           brand,
					cardNumber:      cardNumber,
					cvv:             cvv,
					expirationMonth: expirationMonth,
					expirationYear:  expirationYear,
					success: function( data ) {
						// Remove any old hash input.
						$( 'input[name=pagseguro_credit_card_hash], input[name=pagseguro_credit_card_hash], input[name=pagseguro_installment_value]', form ).remove();

						// Add the hash input.
						form.append( $( '<input name="pagseguro_credit_card_hash" type="hidden" />' ).val( data.card.token ) );
						form.append( $( '<input name="pagseguro_sender_hash" type="hidden" />' ).val( PagSeguroDirectPayment.getSenderHash() ) );
						form.append( $( '<input name="pagseguro_installment_value" type="hidden" />' ).val( $( 'option:selected', installments ).attr( 'data-installment-value' ) ) );

						// Submit the form.
						pagseguro_submit = true;
						form.submit();
					},
					error: function() {
						pagSeguroAddErrorMessage( wc_pagseguro_params.general_error );
					}
				});

			// Display the error messages.
			} else {
				pagSeguroAddErrorMessage( errorHtml );
			}

			return false;
		}

		// Transparent checkout actions.
		if ( wc_pagseguro_params.session_id ) {
			// Initialize the transparent checkout.
			PagSeguroDirectPayment.setSessionId( wc_pagseguro_params.session_id );

			// Display the payment for and init the input masks.
			if ( '1' === wc_checkout_params.is_checkout ) {
				$( 'body' ).on( 'updated_checkout', function() {
					pagSeguroInitPaymentForm();
				});
			} else {
				pagSeguroInitPaymentForm();
			}

			// Update the bank transfer icons classes.
			$( 'body' ).on( 'click', '#pagseguro-bank-transfer-form input[type=radio]', function() {
				$( '#pagseguro-bank-transfer-form li' ).removeClass( 'active' );
				$( this ).parent( 'label' ).parent( 'li' ).addClass( 'active' );
			});

			// Switch the payment method form.
			$( 'body' ).on( 'click', '#pagseguro-payment-methods input[type=radio]', function() {
				pagSeguroShowHideMethodForm( $( this ).val() );
                                calculaDesconto();
			});
                        
                        $( 'body' ).on( 'change', '#pagseguro-card-installments', function() {
                                calculaDesconto();
                        });
                        
                        $( 'body' ).on( 'updated_checkout', function() {
                                calculaDesconto();
                        });

			// Get the credit card brand.
			$( 'body' ).on( 'focusout', '#pagseguro-card-number', function() {
				var bin = $( this ).val().replace( /[^\d]/g, '' ).substr( 0, 6 ),
					instalmments = $( 'body #pagseguro-card-installments' );

				if ( 6 === bin.length ) {
					// Reset the installments.
					instalmments.empty();
					instalmments.attr( 'disabled', 'disabled' );

					PagSeguroDirectPayment.getBrand({
						cardBin: bin,
						success: function( data ) {
							$( 'body' ).trigger( 'pagseguro_credit_card_brand', data.brand.name );
							pagSeguroSetCreditCardBrand( data.brand.name );
						},
						error: function() {
							$( 'body' ).trigger( 'pagseguro_credit_card_brand', 'error' );
							pagSeguroSetCreditCardBrand( 'error' );
						}
					});
				}
			});
			$( 'body' ).on( 'updated_checkout', function() {
				var field = $( 'body #pagseguro-card-number' );

				if ( 0 < field.length ) {
					field.focusout();
				}
			});

			// Set the errors.
			$( 'body' ).on( 'focus', '#pagseguro-card-number, #pagseguro-card-expiry', function() {
				$( '#pagseguro-credit-card-form .woocommerce-error' ).remove();
			});

			// Get the installments.
			$( 'body' ).on( 'pagseguro_credit_card_brand', function( event, brand ) {
				if ( 'error' !== brand ) {
					PagSeguroDirectPayment.getInstallments({
						amount: $( 'body #pagseguro-payment-form' ).data( 'cart_total' ),
						brand: brand,
						success: function( data ) {
							var instalmments = $( 'body #pagseguro-card-installments' );

							if ( false === data.error ) {
								instalmments.empty();
								instalmments.removeAttr( 'disabled' );
								instalmments.append( '<option value="0">--</option>' );

								$.each( data.installments[brand], function( index, installment ) {
                                                                    if (installment.quantity === 1) {
                                                                        installment.installmentAmount = getValorComDesconto();
                                                                    }
                                                                    
                                                                    if (installment.quantity <= 3){
									instalmments.append( pagSeguroGetInstallmentOption( installment ) );
                                                                    }
								});
							} else {
								pagSeguroAddErrorMessage( wc_pagseguro_params.invalid_card );
							}
						},
						error: function() {
							pagSeguroAddErrorMessage( wc_pagseguro_params.invalid_card );
						}
					});
				} else {
					pagSeguroAddErrorMessage( wc_pagseguro_params.invalid_card );
				}
			});

			// Process the credit card data when submit the checkout form.
			$( 'form.checkout' ).on( 'checkout_place_order_pagseguro', function() {
				return pagSeguroformHandler();
			});

			$( 'form#order_review' ).submit( function() {
				return pagSeguroformHandler();
			});

		} else {
			$( 'body' ).on( 'updated_checkout', function() {
				$( '#pagseguro-payment-form' ).remove();
			});
		}
	});

}( jQuery ));
