(function(){

var ui = angular.module('axelor.ui');

ui.directive('uiHelpPopover', function() {
	
	function addRow(table, label, text, klass) {
		var tr = $('<tr></tr>').appendTo(table);
		if (label) {
			$('<th></th>').text(label + ':').appendTo(tr);
		}
		if (klass == null) {
			text = '<code>' + text + '</code>';
		}
		var td = $('<td></td>').html(text).addClass(klass).appendTo(tr);
		if (!label) {
			td.attr('colspan', 2);
		}
		return table;
	}
	
	function getHelp(scope, element, field, mode) {
		
		var text = field.help;
		var table = $('<table class="field-details"></table>');

		if (text) {
			text = text.replace(/\\n/g, '<br>');
			addRow(table, null, text, 'help-text');
		}
		
		if (mode != 'dev') {
			return table;
		}

		if (text) {
			addRow(table, null, '<hr noshade>', 'help-text');
		}
		
		var model = scope._model;
		if (model === field.target) {
			model = scope.$parent._model;
		}

		addRow(table, _t('Object'), model);
		addRow(table, _t('Field Name'), field.name);
		addRow(table, _t('Field Type'), field.serverType);
		
		if (field.type == 'text') {
			return table;
		}
		
		if (field.domain) {
			addRow(table, _t('Filter'), field.domain);
		}
		
		if (field.target) {
			addRow(table, _t('Reference'), field.target);
		}

		var value = scope.$eval('$$original.' + field.name);
		if (value && field.type === 'many-to-one') {
			value = value.id;
		}
		if (value && /-many$/.test(field.type)) {
			var length = value.length;
			value = _.first(value, 5);
			value = _.map(value, function(v){
				return v.id;
			});
			if (length > 5) {
				value.push('...');
			}
			value = value.join(', ');
		}

		addRow(table, _t('Orig. Value'), value);

		return table;
	}

	return function(scope, element, attrs) {
		var forWidget = attrs.forWidget || element.parents('[x-field]:first').attr('id');
		var field = scope.getViewDef(forWidget);
		if (field == null) {
			return;
		}
		var mode = scope.$eval('app.mode') || 'dev';
		if (!field.help && mode != 'dev') {
			return;
		}

		element.popover({
			html: true,
			delay: { show: 1000, hide: 100 },
			animate: true,
			trigger: 'hover',
			title: function() {
				return element.text();
			},
			content: function() {
				return getHelp(scope, element, field, mode);
			}
		});
	};
});

/**
 * The Label widget.
 *
 */
var LabelItem = {
	css: 'label-item',
	cellCss: 'form-label',
	transclude: true,
	template: '<label ui-help-popover ng-transclude></label>',
	link: function(scope, element, attrs, controller) {
			var field = scope.getViewDef(attrs.forWidget);
			if (field && field.required) {
				element.addClass('required');
			}
	}
};

/**
 * The Spacer widget.
 *
 */
var SpacerItem = {
	css: 'spacer-item',
	template: '<div>&nbsp;</div>'
};

/**
 * The Separator widget.
 *
 */
var SeparatorItem = {
	css: 'separator-item',
	showTitle: false,
	scope: {
		title: '@'
	},
	template: '<div><span style="padding-left: 4px;">{{title}}</span><hr style="margin: 4px 0;"></div>'
};

/**
 * The Static Text widget.
 *
 */
var StaticItem = {
	css: 'static-item',
	transclude: true,
	template: '<label ng-transclude></label>'
};

/**
 * The button widget.
 */
var ButtonItem = {
	css: 'button-item',
	transclude: true,
	template: '<button class="btn" type="button" ng-transclude></button>'
};

/**
 * The String widget.
 */
var StringItem = {
	css: 'string-item',
	template: '<input type="text">'
};

/**
 * The Email input widget.
 */
var EmailItem = {
	css: 'email-item',
	template: '<input type="email">'
};

/**
 * The Phone input widget.
 */
var PhoneItem = {
	css: 'phone-item',
	template: '<input type="tel">'
};

/**
 * The Integer input widget.
 */
var IntegerItem = {
	css: 'integer-item',
	require: '?ngModel',
	link: function(scope, element, attrs, model) {

		var props = scope.getViewDef(element),
			precision = props.precision || 18,
			scale = props.scale || 2;
		
		var options = {
			step: 1,
			spin: onSpin,
			change: function( event, ui ) {
				updateModel(element.val(), true);
			}
		};

		model.$parsers.unshift(function(viewValue) {
            var valid = isValid(viewValue);
            model.$setValidity('format', valid);
            return valid ? viewValue : undefined;
        });
		
		var isDecimal = this.isDecimal,
			pattern = isDecimal ? /^(-)?\d+(\.\d+)?$/ : /^\s*-?[0-9]*\s*$/;

		function isNumber(value) {
			return _.isEmpty(value) || _.isNumber(value) || pattern.test(value);
		}

		function isValid(value) {
			var valid = isNumber(value);
            if (valid && _.isString(value)) {
            	var parts = value.split(/\./),
            		integer = parts[0] || "",
            		decimal = parts[1] || "";
            	valid = (integer.length <= precision - scale) && (decimal.length <= scale);
            }
            return valid;
		}

		function format(value) {
			if (isDecimal && _.isString(value)) {
				var parts = value.split(/\./),
					integer = parts[0] || "",
					decimal = parts[1] || "";

				integer = "" + (+integer); // remove leading zero if any
				if (decimal.length <= scale) {
					return integer + '.' + _.string.rpad(decimal, scale, '0');
				}
				decimal = (+decimal.slice(0, scale)) + Math.round("." + decimal.slice(scale));
				decimal = _.string.pad(decimal, scale, '0');
				return integer + '.' + decimal;
			}
			return value;
		}
		
		function updateModel(value, handle) {
			var onChange = element.data('$onChange');

			if (!isNumber(value)) {
	            return ;
            }
			
			value = format(value);

			element.val(value);
			scope.$apply(function(){
				model.$setViewValue(value);
			});
			
		    if (onChange && handle) {
				onChange.handle();
			}
		}
		
		function onSpin(event, ui) {
			
			var text = this.value,
				value = ui.value,
				orig = element.spinner('value'),
				parts, integer, decimal, min, max, dir = 0;

			event.preventDefault();
			
			if (!isNumber(text)) {
				return false;
			}

			if (value < orig)
				dir = -1;
			if (value > orig)
				dir = 1;

			parts = text.split(/\./);
			integer = +parts[0];
			decimal = parts[1];

			integer += dir;
			if (parts.length > 1) {
				value = integer + '.' + decimal;
			}

			min = options.min;
			max = options.max;

			if (_.isNumber(min) && value < min)
				value = min;
			if (_.isNumber(max) && value > max)
				value = max;

			updateModel(value, false);
		}

		if (props.minSize !== undefined)
			options.min = +props.minSize;
		if (props.maxSize !== undefined)
			options.max = +props.maxSize;

		setTimeout(function(){
			element.spinner(options);
			if (scope.isReadonly(element)) {
				element.spinner("disable");
			}
			element.on("on:attrs-change", function(event, data) {
				element.spinner(data.readonly ? "disable" : "enable");
			});
			model.$render = function() {
				var value = model.$viewValue;
				if (value) {
					value = format(value);
				}
				element.val(value);
			};
			model.$render();
		});
	},
	template: '<input type="text">'
};

/**
 * The Decimal input widget.
 */
var DecimalItem = _.extend({}, IntegerItem, {
	css: 'decimal-item',
	isDecimal: true
});

/**
 * The Boolean input widget.
 */
var BooleanItem = {
	css: 'boolean-item',
	template: '<input type="checkbox">'
};

// configure datepicket
if (_t.calendar) {
	$.timepicker.setDefaults(_t.calendar);
}

// configure ui.mask
function createTwoDigitDefinition( maximum ) {
	return function( value ) {
		var number = parseInt( value, 10 );

		if (value === "" || /\D/.test(value) || _.isNaN(number)) {
			return;
		}

		// pad to 2 characters
		number = ( number < 10 ? "0" : "" ) + number;
		if ( number <= maximum ) {
			return number;
		}
	};
}

function yearsDefinition( value ) {
	var temp;

	// if the value is empty, or contains a non-digit, it is invalid
	if ( value === "" || /\D/.test( value ) ) {
		return false;
	}

	// convert 2 digit years to 4 digits, this allows us to type 80 <right>
	if ( value.length <= 2 ) {
		temp = parseInt( value, 10 );
		// before "32" we assume 2000's otherwise 1900's
		if ( temp < 10 ) {
			return "200" + temp;
		} else if ( temp < 32 ) {
			return "20" + temp;
		} else {
			return "19" + temp;
		}
	}
	if ( value.length === 3 ) {
		return "0"+value;
	}
	if ( value.length === 4 ) {
		return value;
	}
}

$.extend($.ui.mask.prototype.options.definitions, {
	"MM": createTwoDigitDefinition( 12 ),
	"DD": createTwoDigitDefinition( 31 ),
	"YYYY": yearsDefinition,
	"HH": createTwoDigitDefinition( 23 ),
	"mm": createTwoDigitDefinition( 59 )
});

// datepicker keyboad navigation hack
var _doKeyDown = $.datepicker._doKeyDown;
$.extend($.datepicker, {
	_doKeyDown: function(event) {
		var inst = $.datepicker._getInst(event.target),
			handled = false;
		inst._keyEvent = true;
		if ($.datepicker._datepickerShowing) {
			switch (event.keyCode) {
			case 36: // home
				$.datepicker._gotoToday(event.target);
				handled = true;
				break;
			case 37: // left
				$.datepicker._adjustDate(event.target, -1, "D");
				handled = true;
				break;
			case 38: // up
				$.datepicker._adjustDate(event.target, -7, "D");
				handled = true;
				break;
			case 39: // right
				$.datepicker._adjustDate(event.target, +1, "D");
				handled = true;
				break;
			case 40: // down
				$.datepicker._adjustDate(event.target, +7, "D");
				handled = true;
				break;
			}
			if (handled) {
				event.ctrlKey = true;
			}
		} else if (event.keyCode === 36 && event.ctrlKey) { // display the date picker on ctrl+home
			$.datepicker._showDatepicker(this);
			handled = true;
		}
		if (handled) {
			event.preventDefault();
			event.stopPropagation();
		} else {
			_doKeyDown(event);
		}
	}
});

/**
 * The DateTime input widget.
 */
var DateTimeItem = {

	css	: 'datetime-item',
	require: '?ngModel',
	
	format: 'DD/MM/YYYY HH:mm',
	mask: 'DD/MM/YYYY HH:mm',

	link: function(scope, element, attrs, controller) {

		var input = element.children('input:first');
		var button = element.find('i:first');
		var options = {
			dateFormat: 'dd/mm/yy',
			showButtonsPanel: false,
			showTime: false,
			showOn: null,
			onSelect: function(dateText, inst) {
				input.mask('value', dateText);
				updateModel();
				if (!inst.timeDefined) {
					input.datetimepicker('hide');
					setTimeout(function(){
						input.focus().select();
					});
				}
			}
		};

		if (this.isDate) {
			options.showTimepicker = false;
		}

		input.datetimepicker(options);
		input.mask({
			mask: this.mask
		});

		var changed = false;
		input.on('change', function(e, ui){
			changed = true;
		});
		input.on('blur', function() {
			if (changed) {
				changed = false;
				updateModel();
			}
		});
		input.on('keydown', function(e){

			if (e.isDefaultPrevented()) {
				return;
			}

			if (e.keyCode === $.ui.keyCode.DOWN) {
				input.datetimepicker('show');
				e.stopPropagation();
				e.preventDefault();
				return false;
			}
			if (e.keyCode === $.ui.keyCode.ENTER && $(this).datepicker("widget").is(':visible')) {
				e.stopPropagation();
				e.preventDefault();
				return false;
			}
			if (e.keyCode === $.ui.keyCode.ENTER || e.keyCode === $.ui.keyCode.TAB) {
				updateModel();
			}
		});
		button.click(function(e, ui){
			if (scope.isReadonly(element)) {
				return;
			}
			input.datetimepicker('show');
		});

		var that = this;
		function updateModel() {
			var masked = input.mask("value") || '',
				value = input.datetimepicker('getDate'),
				oldValue = controller.$viewValue || null,
				onChange = element.data('$onChange');

			if (_.isEmpty(masked)) {
				value = null;
			}

			if (angular.isDate(value)) {
				value = that.isDate ? moment(value).sod().format('YYYY-MM-DD') : moment(value).format();
			}
			
			if (angular.equals(value, oldValue))
				return;

			controller.$setViewValue(value);
			setTimeout(function(){
				scope.$apply();
			});
			
			if (onChange) {
				onChange.handle();
			}
		}

		controller.$render = function() {
			var value = controller.$viewValue;
			if (value) {
				value = moment(value).format(that.format);
				input.mask('value', value);
			} else {
				input.mask('value', '');
			}
		};
	},
	template:
	'<span class="picker-input">'+
	  '<input type="text" autocomplete="off">'+
	  '<span class="picker-icons">'+
	  	'<i class="icon-calendar"></i>'+
	  '</span>'+
	'</span>'
};

var DateItem = _.extend({}, DateTimeItem, {
	format: 'DD/MM/YYYY',
	mask: 'DD/MM/YYYY',
	isDate: true
});

var TimeItem = {
	css: 'time-item',
	mask: 'HH:mm',
	require: '?ngModel',
	link: function(scope, element, attrs, model) {
		
		element.mask({
			mask: this.mask
		});
		
		element.change(function(e, ui) {
			updateModel();
		});
		
		element.on('keydown', function(e){
			if (e.isDefaultPrevented()) {
				return;
			}
			if (e.keyCode === $.ui.keyCode.ENTER || e.keyCode === $.ui.keyCode.TAB) {
				updateModel();
			}
		});
		
		function updateModel() {
			var value = element.val();
			if (model.$viewValue === value)
				return;
			scope.$apply(function(){
				model.$setViewValue(element.val());
			});
		}
	},
	template: '<input type="text">'
};

/**
 * The Text input widget.
 */
var TextItem = {
	css: 'text-item',
	transclude: true,
	template: '<textarea rows="8" ng-transclude></textarea>'
};

var PasswordItem = {
	css: 'password-item',
	template: '<input type="password">'
};

var SelectItem = {
	css: 'select-item',
	cellCss: 'form-item select-item',
	require: '?ngModel',
	scope: true,
	link: function(scope, element, attrs, model) {

		var props = scope.getViewDef(element),
			multiple = props.multiple,
			input = element.children('input:first'),
			selection = [];
		
		if (_.isArray(props.selection)) {
			selection = props.selection;
		}
		
		var data = _.map(selection, function(item){
			return {
				key: item.value,
				value: item.title
			};
		});

		scope.showSelection = function() {
			if (scope.isReadonly(element)) {
				return;
			}
			input.autocomplete("search" , '');
		};
		
		function updateValue(value) {
			var onChange = element.data('$onChange');
			scope.$apply(function(){
				model.$setViewValue(value);
				if (onChange) {
					onChange.handle();
				}
			});
		}
		
		input.keydown(function(e){

			var KEY = $.ui.keyCode;

			switch(e.keyCode) {
			case KEY.DELETE:
			case KEY.BACKSPACE:
				updateValue('');
				input.val('');
			}
		});
		
		input.autocomplete({
			minLength: 0,
			source: data,
			focus: function(event, ui) {
				return false;
			},
			select: function(event, ui) {
				var val, terms;
				if (multiple) {
					val = model.$modelValue || [];
					terms = this.value || "";

					if (!_.isArray(val)) val = val.split(',');
					if (_.indexOf(val, ui.item.key) > -1)
						return false;

					val.push(ui.item.key);
					
					terms = terms.trim() === "" ? [] : terms.split(/,\s*/);
					terms.push(ui.item.value);
					
					this.value = terms.join(', ');
					updateValue(val);
				} else {
					this.value = ui.item.value;
					updateValue(ui.item.key);
				}
				return false;
			}
		});
		
		model.$render = function() {
			var val = model.$modelValue;
			if (val === null || _.isUndefined(val))
				return input.val('');

			if (props.serverType == "integer") {
				val = "" + val;
			}
			if (!_.isArray(val)) {
				val = [val];
			}
			
			var values = _.filter(data, function(item){
				return val.indexOf(item.key) > -1;
			});
			values = _.pluck(values, 'value');
			setTimeout(function(){
				input.val(multiple ? values.join(',') : _.first(values));
			});
		};
		attrs.$observe('disabled', function(value){
			input.autocomplete(value && 'disable' || 'enable');
		});
	},
	replace: true,
	template:
	'<span class="picker-input">'+
		'<input type="text" autocomplete="off">'+
		'<span class="picker-icons">'+
			'<i class="icon-caret-down" ng-click="showSelection()"></i>'+
		'</span>'+
	'</span>'
};

var SelectQueryItem = {
		css: 'select-item',
		cellCss: 'form-item select-item',
		require: '?ngModel',
		scope: true,
		link: function(scope, element, attrs, model) {
			
			var query = scope.$eval(attrs.query),
				input = element.children('input:first');

			scope.showSelection = function() {
				input.autocomplete("search" , '');
			};
			
			input.keydown(function(e){
				if (e.keyCode != 9)
					return false;
			});
			
			model.$render = function() {
				var value = model.$modelValue;
				input.val(value);
			};
			
			setTimeout(function(){
				input.autocomplete({
					minLength: 0,
					source: query,
					select: function(event, ui) {
						scope.$apply(function(){
							model.$setViewValue(ui.item.id);
						});
					}
				});
			});
		},
		replace: true,
		template:
		'<span class="picker-input">'+
			'<input type="text" autocomplete="off">'+
			'<span class="picker-icons">'+
				'<i class="icon-caret-down" ng-click="showSelection()"></i>'+
			'</span>'+
		'</span>'
};

// register directives

var directives = {
	
	'uiLabel'		: LabelItem,
	'uiSpacer'		: SpacerItem,
	'uiSeparator'	: SeparatorItem,
	'uiStatic'		: StaticItem,
	'uiButton'		: ButtonItem,
	'uiSelect'		: SelectItem,
	'uiSelectQuery'	: SelectQueryItem,
	
	'uiString'	: StringItem,
	'uiEmail'	: EmailItem,
	'uiPhone'	: PhoneItem,
	'uiInteger'	: IntegerItem,
	'uiDecimal'	: DecimalItem,
	'uiBoolean'	: BooleanItem,
	'uiDatetime': DateTimeItem,
	'uiDate'	: DateItem,
	'uiTime'	: TimeItem,
	'uiText'	: TextItem,
	'uiPassword': PasswordItem
};

for(var name in directives) {
	ui.formDirective(name, directives[name]);
}

})(this);
