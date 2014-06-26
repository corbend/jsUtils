var isHighYear = function(year) {
    //определение високосного года
    var d = new Date(year, 1, 29);
    return d.getMonth() == 1;
}

var getDaysInMonths = function(year, index, c) {
    
    var daysInMonths = [31, isHighYear(year + index) ? 29: 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    return c && daysInMonths[c] || daysInMonths
}



var splitByArray = function(n, byCount, startWith, arr) {
    //разбиваем диапазон по массивам клонам arr по ко
    var a, parts, r, dif, tail, head, cl;
    if (_.isArray(arr)) {
        byCount = arr.length;
    }
    a = arr || _.range(byCount).map(function(x) {return x + (startWith || 0)});
    parts = parseInt(n / byCount) + 1;
    r = _.range(parts).map(function(h, index) {
        cl = a;
        if (_.isFunction(a)) {
            cl = a(index);
        }
        return _.clone(cl)
    });
    dif = n - (r.length - 1) * byCount;
    tail = r.slice(-1)[0].slice(0, dif);
    head = r.slice(0, r.length - 1);

    if (tail.length) {
        head.push(tail);
    }
    return head;
}

var cloneUntil = function(arr, predicate, aggregateFunc) {
    var cl = [];
    var a = arr;
    var index = 0;
    var acc = 0;
    var resObj;
    var endPart;
    
    do  {
        if (_.isFunction(arr)) {
            a = arr(index);
        }
        index++;
        resObj = aggregateFunc(a, acc, predicate);
        acc = resObj['result'];
        if (!resObj.stop) {
            cl.push(a);
        } else {
            endPart = a.slice(0, resObj['breakIndex'])
            if (endPart.length) {
                cl.push(endPart);
            }
        }
    } while (!resObj.stop)

    return cl;
}

var sum_ = function(acc, cValue) {return acc + cValue};

var recurSum = function(acc, arr) {

    if (!_.isArray(arr)) {
        return acc + arr;
    } else {
        return _.reduce(arr.map(function(a) {
            return recurSum(acc, a);
        }), sum_, 0);
    }
}

var getDaysBettween = function(startYear, endYear, overMonth) {
    //функция хелпер для получения количества дней между 2 годами
    //@overMonth - количество месяцев в неполном году endYear
    var overflow = overMonth ? overMonth : 0;
    var dif;
    dif = endYear ? (endYear - startYear + 1) * 12 : 12;
    
    if (endYear < startYear) {
        dif = 0;    
    }
    
    return recurSum(0, splitByArray(dif + overflow, 12, 1, _.partial(getDaysInMonths, startYear)));
}

var getMonthsBettween = function(startYear, dayZ) {
    
    var aggFunc = function(a, acc, predicate) {
        var result;
        var breakIndex = 0;
        var stop = false;
        var break_ = false;
        
        var r = _.reduce(a, function(a, b, i) {
            stop = !predicate(a + b);
   
            if (!stop && !break_) {breakIndex = i + 1 }
            else break_ = true; 
         
            return  !break_ ? (a + b): a
        }, acc);

        result = {
            breakIndex: breakIndex,
            result: r,
            stop: break_ 
        }

        return result;
    }
    
    return recurSum(0, cloneUntil(
        _.partial(getDaysInMonths, startYear),
        function(a) {return a <= dayZ}, 
        aggFunc
    ).map(function(a) {return a.length}));
}


var Converter = function(from, to, multiplier, isPrecise) {

    this.from = from;
    this.to = to;
    this.multiplier = multiplier;
    this.precise = isPrecise != null ? isPrecise: true;

    this.isPrecise = function() { return this.precise };
}

Converter.prototype = {
        
    convert: function(initV, f) {
        var result;
        result = f(initV, this.multiplier);
        //console.log("convert->" + initV +", " + this.multiplier + "->" + result);

        return result;
    },
    isPrecise: function(converter) {
        return (converter? converter.isPrecise(): this.isPrecise());
    },
    toString: function() {
        return this.from + " -> " + this.to + " Converter";
    }
}

var MonthToDayConverter = function(fromYear) {

    this.from = "month";
    this.to = "day";
    this.multiplier = 1;
    this.precise = true;
    
    this.convert = function(monthsOrDay, f, reversed) {
        
        var result, startYear, endYear, overMonth;
             
        if (!fromYear && !this._options.length) throw "startYear is required argument";
        
        startYear = fromYear || this._options[0];
        
        if (!reversed) {
            endYear = startYear + Math.floor(monthsOrDay / 12) - 1;
            overMonth = monthsOrDay % 12;
            result = getDaysBettween(startYear, endYear, overMonth);
        } else {
            //console.log("reversed!");
            overMonth = 0;
            var rr = getMonthsBettween(startYear, monthsOrDay);
            result = rr;
        }
        
        //console.log(startYear);
        //console.log(endYear);
        //console.log("CONVERT DAYS->" + monthsOrDay + "->" + result);
        return result;
    }
};

MonthToDayConverter.prototype = new Converter();

    
var TimeConverter = function(from, to) {
     
    var converters;
    
    var scope = this;
    this.from = from;
    this.to = to;
    
    var simpleConverters = [
        new Converter("year", "month", 12),

        new MonthToDayConverter(),
        new Converter("month", "week", 4, false),
        new Converter("week", "day", 7, false),

        new Converter("day", "hour", 24),
        new Converter("hour", "minute", 60),
        new Converter("minute", "second", 60),
        new Converter("second", "mssecond", 1000),
    ];
    //проставляем весы
    //console.log(simpleConverters);
    converters = simpleConverters.map(function(c, index) {
        c.weight = index;
        return c;
    });
    //console.log("CONVERTERS->");
    //console.log(converters);
    this.isReverse = function() {
        return this.reversed;
    }

    var getNonPrecised = function() {
        return _.filter(converters, function(c) {
            return !c.isPrecise();
        })
    };

    var removeNonComplimented = function(predicate) {
        //убираем все комплиментарные конверторы
        var ignoreStart, ignoreEnd;
        var nonPrecised = getNonPrecised();

        ignoreStart = nonPrecised[0];
        ignoreEnd = nonPrecised.slice(-1)[0];

        return _.filter(converters, function(c) {
            return ignoreStart != c.from && ignoreEnd != c.to;
        })
    }

    var createComposite = function(start, end) {
        var middleConverters, predicate, cvs;
    
        var arr = [], composite = [];
        
        predicate = function(c) { return scope.isReverse() ? 
            c.weight < start.weight && c.weight > end.weight:
            c.weight > start.weight && c.weight < end.weight
        ;}
        
        cvs = scope.isReverse() ? converters.reverse() : converters;
        middleConverters = _.filter(cvs, predicate);
        
        //console.log("MIDDLE->");
        //console.log(middleConverters);
        
        if (start.isPrecise() && end.isPrecise()) {
            middleConverters = _.filter(middleConverters, function(c) {
                return c.isPrecise();
            });
        } else {
            //console.log("use non precised!");
            middleConverters = removeNonComplimented();
        }
        
        if (!scope.isReverse()) {
            composite.push(start);
        }
        
        composite = composite.concat(middleConverters);
        
        if (scope.isReverse()) { 
            composite.push(end);
        }

        //console.log("COMPOSITE");
        //console.log(composite);
        return composite;
    }
    
    this.init = function() {
        var fromConverter, toConverter;
                    
        this.reversed = false;

        fromConverter = _.filter(converters, function(c) {
            return c.from == scope.from;
        })[0];
            
        //console.log(fromConverter);
        
        toConverter = _.filter(converters, function(c) {
            return c.from == scope.to;
        })[0];
        
        //console.log(toConverter);
        scope.reversed = toConverter.weight < fromConverter.weight;
        //console.log(scope.isReverse());
        
        scope.__operator = (function() {
            return scope.isReverse() ?
            function(a, b) {
                //console.log(b.convert(a, function(sv, v) {return sv / v}));
                return b.convert(a, function(sv, v) {return sv / v}, true)
            } :
            function(a, b) {
                //console.log("iteration->" + a + "," + b);
                //console.log(b.convert(a, function(sv, v) {return sv * v}));
                return b.convert(a, function(sv, v) {return sv * v})
            }
        })()

        scope.__chain = createComposite(fromConverter, toConverter);
    }
      
   //настройка конвертеров дополнительными параметрами
    this.setup = function() {
        var args = Array.prototype.slice.apply(arguments);
        converters.forEach(function(sc) {
            sc._initiator = this;
            sc._options = args;
        }, this);
    }
    
    var firstParamIsYear = this.from == "year";
   
    var calculate = firstParamIsYear ? 
        function(startYear, endYear) {
        
            var dif;
            dif = endYear ? endYear - startYear: startYear;
            //console.log(dif);
            this.setup.apply(this, arguments);
            //console.log(this.__chain);
            return _(this.__chain).chain()
            .reduce(this.__operator, dif).value();
        }: function(offset, startYear) {
            var args = [startYear];
            this.setup.apply(this, args);
            
            return _(this.__chain).chain()
            .reduce(this.__operator, offset).value();
        }
    
    this.delta = _.bind(calculate, scope);
    
    this.init();
}

var cv0 = new TimeConverter("year", "day");
var cv1 = new TimeConverter("month", "day");
var cv2 = new TimeConverter("month", "hour");
var cv3 = new TimeConverter("hour", "month");
var cv4 = new TimeConverter("day", "year");
var cv5 = new TimeConverter("week", "year");

//ТЕСТЫ для функций
//console.log(getDaysBettween(2015) == 365);
//console.log(getDaysBettween(2016) == 366);
//console.log(getDaysBettween(2015, 2016) == 731);
//console.log(recurSum(0, [[1, 2, 3], [1, 2], [[1, 2], 3]]) == 15);
//console.log(getMonthsBettween(2016, 365) == 11);
//console.log(getMonthsBettween(2016, 366) == 12);

console.log("CV0=" + cv0.delta(2014, 2015));
console.log("CV1=" + cv1.delta(24, 2014));
console.log("CV2=" + cv2.delta(2, 2014));
console.log("CV3=" + cv3.delta(1464, 2014));
console.log("CV4=" + cv4.delta(1096, 2014));
console.log("CV5=" + cv5.delta(2014, 2015));
