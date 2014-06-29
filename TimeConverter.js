var isHighYear = function(year) {
    //определение високосного года
    var d = new Date(year, 1, 29);
    return d.getMonth() == 1;
};

var getDaysInMonths = function(year, index, c) {
    
    var daysInMonths = [31, isHighYear(year + (index || 0)) ? 29: 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    return c && daysInMonths[c] || daysInMonths;
};

var splitByArray = function(n, byCount, startWith, arr) {
    //разбиваем диапазон по массивам клонам arr по количеству byCount
    var a, parts, r, dif, tail, head, cl;
    if (_.isArray(arr)) {
        byCount = arr.length;
    }
    a = arr || _.range(byCount).map(function(x) {return x + (startWith || 0);});
    parts = parseInt(n / byCount, 10) + 1;
    r = _.range(parts).map(function(h, index) {
        cl = a;
        if (_.isFunction(a)) {
            cl = a(index);
        }
        return _.clone(cl);
    });
    dif = n - (r.length - 1) * byCount;
    tail = r.slice(-1)[0].slice(0, dif);
    head = r.slice(0, r.length - 1);

    if (tail.length) {
        head.push(tail);
    }

    return head;
};

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
        acc = resObj.result;
        if (!resObj.stop) {
            cl.push(a);
        } else {
            endPart = a.slice(0, resObj.breakIndex);
            if (endPart.length) {
                cl.push(endPart);
            }
        }
    } while (!resObj.stop);

    return cl;
};

var sum_ = function(acc, cValue) {return acc + cValue; };

var recurSum = function(acc, arr) {

    if (!_.isArray(arr)) {
        return acc + arr;
    } else {
        return _.reduce(arr.map(function(a) {
            return recurSum(acc, a);
        }), sum_, 0);
    }
};

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
};

var getMonthsBettween = function(startYear, dayZ) {
    
    var aggFunc = function(a, acc, predicate) {
        var result;
        var breakIndex = 0;
        var stop = false;
        var break_ = false;
        
        var r = _.reduce(a, function(a, b, i) {
            stop = !predicate(a + b);
   
            if (!stop && !break_) {breakIndex = i + 1;}
            else break_ = true;
         
            return  !break_ ? (a + b): a;
        }, acc);

        result = {
            breakIndex: breakIndex,
            result: r,
            stop: break_
        };

        return result;
    };
    
    return recurSum(0, cloneUntil(
        _.partial(getDaysInMonths, startYear),
        function(a) {return a <= dayZ;},
        aggFunc
    ).map(function(a) {return a.length;}));
};


var Converter = function(from, to, multiplier, isPrecise) {

    this.from = from;
    this.to = to;
    this.multiplier = multiplier;
    this.precise = isPrecise !== false ? true: isPrecise;

    this.isPrecise = function() { return this.precise; };
};

Converter.prototype = {
        
    convert: function(initV, f) {
        var result;
        result = f(initV, this.multiplier);
        console.log("convert->" + initV + ", " + this.multiplier + "->" + result);

        return result;
    },
    isPrecise: function(converter) {
        return (converter? converter.isPrecise(): this.isPrecise());
    },
    toString: function() {
        return this.from + " -> " + this.to + " Converter";
    }
};

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
    };
};

MonthToDayConverter.prototype = new Converter();

    
var TimeConverter = function(from, to, replaceOn) {
    //replaceOn - параметр определяющий замену конвертора при переводе
    //в определенные единицы
    var converters;
    this.__constants = {
        DATE_MODE: 1,
        PLAIN_MODE: 2
    }
    
    var calcMode = from instanceof Date ?
        this.__constants['DATE_MODE'] :
        this.__constants['PLAIN_MODE'];
        
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
        new Converter("mssecond", "microsecond", 1000)
    ];
    //проставляем весы
    //console.log(simpleConverters);
    converters = simpleConverters.map(function(c, index) {
        c.weight = index;
        
        if (index > 0) {
            c.ancestor = simpleConverters[index - 1];
        }
        
        return c;
    });
    //console.log("CONVERTERS->");
    //console.log(converters);
    this.isReverse = function() {
        return this.reversed;
    };

    var getNonPrecised = function(cs) {
        return _.filter(cs, function(c) {
            return !c.isPrecise();
        });
    };

    var removeNonComplimented = function(arr) {
        //убираем все комплиментарные конверторы
        var ignoreStart, ignoreEnd;
        var nonPrecised = getNonPrecised(arr);
        console.log(nonPrecised);
        
        ignoreStart = nonPrecised[0];
        ignoreEnd = nonPrecised.slice(-1)[0];
        
        console.log("breakers");    
        console.log(ignoreStart);
        console.log(ignoreEnd);
        
        filtered = _.filter(arr, function(c) {
            return (ignoreStart.from != c.from);
        });
        
        if (ignoreStart == ignoreEnd) {
            filtered.push(ignoreStart);
        }
        return filtered;
    };

    var createComposite = function(start, end) {
        var middleConverters, predicate, cvs;
    
        var arr = [], composite = [];
        
        predicate = function(c) { return scope.isReverse() ?
            c.weight < start.weight && c.weight > end.weight:
            c.weight > start.weight && c.weight < end.weight
        ;};
        
        cvs = scope.isReverse() ? converters.reverse() : converters;
        middleConverters = _.filter(cvs, predicate);
        
        //console.log("MIDDLE->");
        //console.log(middleConverters);
        console.log("DEBUG->");
        console.log(start);
        console.log(end);
        if (start.isPrecise() && end.isPrecise()) {
            middleConverters = _.filter(middleConverters, function(c) {
                return c.isPrecise();
            });
        } else {
            console.log("use non precised!");
            middleConverters = removeNonComplimented(middleConverters);
            console.log(middleConverters);
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
    };
    
    this.init = function() {
        var fromConverter, toConverter;
                    
        this.reversed = false;

        fromConverter = _.filter(converters, function(c) {
            return c.from == scope.from;
        })[0];
            
        //console.log("start->");
        //console.log(fromConverter);
        
        toConverter = _.filter(converters, function(c) {
            return c.from == scope.to;
        })[0];
        
        this.fromConverter = fromConverter;
        this.toConverter = toConverter;
        
        //console.log("end->");
        //console.log(toConverter);
        scope.reversed = toConverter.weight < fromConverter.weight;
        //console.log(scope.isReverse());
        
        scope.__operator = (function() {
            return scope.isReverse() ?
            function(a, b) {
                //console.log(b.convert(a, function(sv, v) {return sv / v}));
                return b.convert(a, function(sv, v) {return sv / v;}, true);
            } :
            function(a, b) {
                //console.log("iteration->" + a + "," + b);
                //console.log(b.convert(a, function(sv, v) {return sv * v}));
                return b.convert(a, function(sv, v) {return sv * v;});
            };
        })();

        scope.__chain = createComposite(fromConverter, toConverter);
    };
      
   //настройка конвертеров дополнительными параметрами
    this.setup = function() {
        var args = Array.prototype.slice.apply(arguments);
        converters.forEach(function(sc) {
            sc._initiator = this;
            sc._options = args;
        }, this);
    };
    
    var firstParamIsYear = this.from == "year";
   
    var calculate = firstParamIsYear ?
        function(startYear, endYear) {
        
            var dif;
                
            if (startYear == endYear) {
                endYear += 1;
            }
            
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
        };
    
    this.delta = _.bind(calculate, scope);
    
    this.init();
};

var getDays = function(dat, full, notIncludeLast) {
    //считает сколько дней с начала года до текущего месяца
    //если full = true - за полный год
    var monthCount = full ? 12 : dat.getMonth();

    var months = getDaysInMonths(dat.getFullYear()).slice(0, monthCount);

    return _.reduce(_.flatten(months), sum_, 0) + (full || !notIncludeLast? 0 : dat.getDate());
}

var getWeekdays = function(dat, full) {
    //считает сколько недель с начала года до текущего месяца
    //если full = true - за полный год
        
    return getDays(dat, full) / 7;
}

var getFullValue = function(date_, unit) {
    /** получаем полное количество единиц времени для заданной даты. Считается от начала дня
     * пример: getFullValue(new Date(2014, 0, 1, 2, 1), "minutes") == 121
     */
    var steps, stepIndex, methods, inc, s, a, absi, m, ms, nextUnit;

    methods = {
        "day": function(d) {
            return d.getDate() - 1;
        },
        "hour": function(d) {return d.getHours();},
        "minute": function(d) {return d.getMinutes();},
        "second": function(d) {return d.getSeconds();},
        "mssecond": function(d) {return d.getMilliseconds();},
    }
    steps = ["day", "hour", "minute", "second", "mssecond"];
    stepIndex = _.indexOf(steps, unit);
    mults = [1, 24, 60, 60];
    inc = 0;
    s = 0;
    ms = _.clone(mults);

    while(inc <= stepIndex) {

        nextUnit = steps[inc];
        method = methods[inc];    
        absi = methods[nextUnit](date_);
        m = _.reduce(ms.slice(inc+1, stepIndex + 1), 
            function(a , b) {return a * b;}, 1);
        a = absi * m;
        s += a;
        inc++;
    }

    return s;
}

TimeConverter.prototype = {
    __accumulate: function(deep) {
        
        var cvs = [], lastAncestor, r = 1, multiplier;
        lastAncestor = this.toConverter.ancestor;
        multiplier = lastAncestor.multiplier;
        
        r = multiplier;
        
        if (deep != null || deep != -1) {
            for (var d = 0; d < deep + 1; d++) {
                lastAncestor = lastAncestor.ancestor;
                cvs.push(lastAncestor.multiplier);
            }
            r = _.reduce(cvs, function(a, b) {return a * b}, r);
        }

        return r;
    },
    fix: function(date_, end) {
        
        var steps, stepIndex, r, base, total, dovesok;
        
        steps = ["day", "hour", "minute", "second", "mssecond"];
        incs = [0, 0, 0, 0, 0, 0];
        stepIndex = _.indexOf(steps, this.to);
        
        dovesok = getFullValue(date_, this.to);

        if (this.to == "day") {
            base = getDays(date_, false, false) + dovesok;
            total = getDays(date_, true, false);
        } else {

            console.log("DOV->" + dovesok);
            base = getDays(date_, false, false) * this.__accumulate(stepIndex - 2) + dovesok;
            total = getDays(date_, true, false) * this.__accumulate(stepIndex - 2);

        }
        console.log(end);
        console.log(base);
        console.log(total);
        if (end) {
            r = total - base;
        } else {
            r = base;
        }

        console.log("R->" + r);

        return r + incs[stepIndex];
    },
    fitToDateLeft: function(date_) {
        //подрезаем интервал слева и справа, чтобы получить точное
        //количество единиц
        var valL = 0;
        console.log("LEFT");
        switch(this.to) {
            case "month":
                valL = date_.getMonth();
                break;
            case "week":
                valL = getWeekdays(date_) ;
                break;
            case "day": case "hour": case "minute": case "second": case "mssecond":
                valL = this.fix(date_);
        }
        
        return valL;
    },
    fitToDateRight: function(date_) {
        //подрезаем интервал слева и справа, чтобы получить точное
        //количество единиц
        var valL = 0;
        console.log("RIGTH");
        switch(this.to) {
            case "month":
                valL = 12 - date_.getMonth();
                break;
            case "week":
                valL = getWeekdays(date_, true) - getWeekdays(date_) ;
                break;
            case "day": case "hour": case "minute": case "second": case "mssecond":
                valL = this.fix(date_, true);
        }
        
        return valL;
    },
    convert: function(count, convertTo) {
        var start, end, steps, ms, r;

        steps = ["day", "hour", "minute", "second", "mssecond", ""];
        ms = [1, 24, 60, 60, 1000, 1000];

        start = _.indexOf(steps, this.to);
        end = _.indexOf(steps, convertTo || 'mssecond');

        var r = count * _.reduce(ms.slice(start + 1, end + 1), function(a, b) {return a * b}, 1);

        return r;
    }
}

/*
var cv0 = new TimeConverter("year", "day");
var cv1 = new TimeConverter("month", "day");
var cv2 = new TimeConverter("month", "hour");
var cv3 = new TimeConverter("hour", "month");
var cv4 = new TimeConverter("day", "year");
var cv5 = new TimeConverter("week", "year");
var cv6 = new TimeConverter("year", "week");
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
console.log("CV5=" + cv5.delta(52, 2016));
console.log("CV6=" + cv6.delta(2014, 2016));
*/

var formatHours = function(arr) {
    var prefix;
    
    return arr.map(function(v) {
        prefix = v < 10? "0": "";
        return  prefix + v.toString() + ":00";
    });
};

//дни недели начинаются с воскресенья
var timeRulerUnits = {
    "day" : {
        dataShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        dataFull: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
    },
    "month" : {
        dataFull: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
        dataShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
    },
    "hour": {
        dataShort: formatHours(_.range(24)),
        dataFull: formatHours(_.range(24))
    }
}


var cycle = function(arr, count, backward) {
    //смещение массива единиц измерения на определенное количество по циклу
    //пример: cycle([1, 2, 3], 1) == [3, 1, 2]
    var src = _.clone(arr), c = 0;

    while (count > c++) {
        if (!backward) {
            src.unshift(src.pop());
        } else {
            src.push(src.shift());
        }
    }

    return src;
}

var timeUtils = timeUtils || {
    __syncUnits: function(dat, unit, units, back) {
        var r = units;

        switch (unit) {
            case "day":
                r = cycle(units, dat.getDay(), back);
                break;
            case "month":
                //месяц начинается с 0
                r = cycle(units, dat.getMonth(), back);
                break;
            case "hour":
                r = cycle(units, dat.getHours(), back);
                break;
            default:
                r = units;
        }

        return r;
    },
    getTimeLine: function(startDate, endDate, toUnit, short, fromUnit, formatter) {
        /**
         * функция возвращающая массив из дат (линию времени), входящих в определенный промежуток
         * времени
         *  Применимо для построения осей координат для графиков по времени
         * @startDate - дата откуда начинается линия времени
         * @endDate - дата окончания линии
         * @fromUnit - единица измерения времени в которой задан интервал (start, end)
         * @toUnit - на какие единицы времени нужно поделить интервал (период)
         * @formatter - функция форматирования маркера интервала
         */

        var units, converter, count, verboseUnits, temp, fixLeft, fixRight, timeLine, useUnits;

        units = ["year", "month", "week", "day", "hour", "minute", "second", "mssecond", "custom"];

        if (_.indexOf(units, toUnit) == -1) throw "timeUnit is incorrect";
        
        if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
            throw "startDate and endDate argument must be Date type!";
        }
        
        if (startDate > endDate) {
            throw "endDate must be greater than startDate";
        }
        
        verboseUnits = timeRulerUnits[toUnit];
        
        if (!fromUnit) {
            fromUnit = "year";
        }
        
        //определяем конвертер 
        console.log(verboseUnits);
        converter = new TimeConverter(fromUnit, toUnit);
        //считаем единицы
        if (timeUtils.__preventOverflow && toUnit == "seconds") {
            count = endDate.valueOf() - startDate.valueOf();

            if (count > 30000000) {
                throw "Overflow"
            }

        }

        count = converter.delta(startDate.getFullYear(), endDate.getFullYear() + 1);

        console.log("TOTAL=" + count);
        fixLeft = converter.fitToDateLeft(startDate);
        fixRight = converter.fitToDateRight(endDate);
                 
        if (fixLeft < 0) fixLeft = 0;
            
        console.log(fixLeft);
        console.log(fixRight);

        console.log("F=" + (count - fixRight - fixLeft));

        var interval = count - fixRight - fixLeft + (this.__rightEdgeInclude? 1: 0);

        if (verboseUnits) {
            
            verboseUnits = short ? verboseUnits.dataShort : verboseUnits.dataFull;
            verboseUnits = this.__syncUnits(startDate, toUnit, verboseUnits, true);
            temp = splitByArray(interval, verboseUnits.length, null, verboseUnits);

        } else {
           
            var value;
             
            temp = _(_.range(interval)).chain()
            .map(function(addition) {
                value = new Date(startDate.valueOf() + converter.convert(addition, "mssecond"));
                return !formatter? value : formatter(val);
            }).value();
            
        }

        temp = _.flatten(temp);

        console.log(fixLeft);
        console.log(fixRight);
        timeLine = temp.slice(0, temp.length);

        console.log(timeLine);
        console.log(timeLine.length);
        return timeLine;
    }
};

timeUtils.__preventOverflow = true;
timeUtils.__rightEdgeInclude = true;

var testConverter = new TimeConverter("year", "day");
//пример получения линии за 1 месяц (с 1 по 1 число)
// console.log(new TimeConverter("year", "month").delta(new Date(2014, 0, 1), new Date(2016, 5, 1)));