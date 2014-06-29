(function(_, d3, Rickshaw, document) {

	var pl = new Rickshaw.Color.Palette({scheme: 'colorwheel', interpolatedStopCount: 1});

	var Randomizer = function(factory, seriesCount, pointsCount) {

		this.fc = factory;
		this.sCount = seriesCount;
		this.pCount = pointsCount;

		this.dataPool = new factory(pointsCount);

		this.init = function() {
			this.__buffer = _.map(_.range(this.sCount), function() {return [];});
		}

		this.update = function() {
			this.dataPool.addData(this.__buffer);
		}

		this.get = function(addPoints) {
			var len = addPoints || this.pCount;

			for (var i = 0; i < len; i++) {
				this.dataPool.addData(this.__buffer);
			}

			return this.__buffer;
		}

		getEmpties = function(n) {
			return _.map(_.range(n), function() {
				return {};
			})
		}

		this.slide = function(number) {

			var cut = _.map(this.__buffer, function(b, index) {
				return b.slice(number - 1, this.pCount);
			}, this);
			var old = this.__buffer;
			this.clear(this.__buffer);
			this.__buffer = cut;
			this.get(number);
		}

		this.clear = function(d) {
			this.dataPool.removeData(d || this.__buffer);
		}

		this.init();
	}

	var rand = new Randomizer(Rickshaw.Fixtures.RandomData, 3, 100);

	var createTestSeries = function(names) {

		var seriesBuffer = rand.get();

		var seriesObject = {
			name: '',
			data: null,
			color: null
		}

		return _.map(names, function(name, index) {
			var cl = _.clone(seriesObject);
			cl.name = name;
			cl.data = seriesBuffer[index];
			cl.color = pl.color();
			return cl;
		})
	}

	var series = createTestSeries(['Прибыль', 'Убытки']);
	console.log(series);

	var g = new Rickshaw.Graph({
		element: document.getElementById('time-chart'),
		renderer: 'area',
		series: series
	})

	var MChart = MChart || {};

	MChart.XTime = Rickshaw.Class.create(Rickshaw.Graph.Axis.Time, {
		ticksOffsets: function() {

			var domain = this.graph.x.domain();

			var unitObject = {
				seconds: 0,
				formatter: function(v) { return v;},
				name: ''
			}

			var valueObject = {
				value: '',
				unit: null
			}

			// var unit = this.fixedTimeUnit || this.appropriateTimeUnit();
			var timePoints = this.timeFixture;

			// var count = Math.ceil((domain[1] - domain[0]) / unit.seconds);

			var offsets = [];

			timePoints.forEach(function(mark) {

				var v = _.clone(valueObject);
				var u = _.clone(unitObject);

				u.name = this.fixedTimeUnit;
				v.unit = u;

				v.value = mark;

				offsets.push(v);
			}, this);

			return offsets;
		}
	});

	// var xAxis = new MChart.XTime({
	// 	graph: g,
	// 	ticksTreatment: 'glow',
	// 	timeFixture: timeUtils.getTimeLine(new Date(2014, 0, 1), new Date(2014, 1, 0), "hour")
	// });
	
	g.render();

	var yAxis = new Rickshaw.Graph.Axis.Y({
		graph: g,
		pixelsPerTick: 10
		// tickFormat: Rickshaw.Fixtures.Number.formatKMBT
		// ticksTreatment: "glow"
	})

	yAxis.render();

	var update = function(mode) {

		var modes = ["incremental", "accumulative"];
		var exec = {
			"incremental": function() {
				rand.clear();
				rand.update();
				g.update();
			},
			"accumulative": function() {
				rand.update();
				g.update();
			}
		}
		
		return setInterval(function() {
			exec[mode]();
		}, 500);
	}

	var timer;

	window.MChart = {
		startVisualization: function() {
			if (!timer) {
				timer = update("accumulative");
			}
		},
		stopVisualization: function() {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		}
	}

	return window.MChart;

})(_, d3, Rickshaw, document);