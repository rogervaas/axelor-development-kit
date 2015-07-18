/*
 * Axelor Business Solutions
 *
 * Copyright (C) 2005-2015 Axelor (<http://axelor.com>).
 *
 * This program is free software: you can redistribute it and/or  modify
 * it under the terms of the GNU Affero General Public License, version 3,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
(function(){

var ui = angular.module('axelor.ui');

function inputDialog(options, callback) {

	var opts = _.extend({
		value: "",
		title: "",
		titleOK: _t("OK"),
		titleCancel: _t("Cancel"),
	}, options);

	var html = "" +
	"<div>" +
		"<input type='text' value='" + opts.value +"'>" +
	"</div>";

	var dialog = axelor.dialogs.box(html, {
		title: opts.title,
		buttons: [{
			'text': opts.titleCancel,
			'class': 'btn',
			'click': close
		}, {
			'text': opts.titleOK,
			'class': 'btn btn-primary',
			'click': submit
		}]
	})
	.on("keypress", "input", function (e) {
		if (e.keyCode === 13) {
			submit();
		}
	});

	function close() {
		if (dialog) {
			dialog.dialog("close");
			dialog = null;
		}
	}

	function submit() {
		var value = dialog.find("input").val().trim();
		if (value) {
			return callback(value, close);
		}
		return close();
	}

	dialog.parent().addClass("dms-folder-dialog");
	setTimeout(function() {
		dialog.find("input").focus().select();
	});
}

ui.controller("DMSFileListCtrl", DMSFileListCtrl);
DMSFileListCtrl.$inject = ['$scope', '$element'];
function DMSFileListCtrl($scope, $element) {
	GridViewCtrl.call(this, $scope, $element);

	var _params = $scope._viewParams;
	var _domain = $scope._domain || "";
	if (_domain) {
		_domain += " AND ";
	}

	$scope.$emptyMessage = _t("No documents found.");
	$scope.$confirmMessage = _t("Are you sure you want to delete selected documents?");

	$scope.currentFilter = null;
	$scope.currentFolder = null;
	$scope.currentPaths = [];

	Object.defineProperty($scope, "_domain", {
		get: function () {
			if ($scope.currentFilter) {
				return _domain + "self.isDirectory = false";
			}
			var parent = $scope.getCurrentParent();
			if (parent && parent.id) {
				return _domain + "self.parent.id = " + parent.id;
			}
			return _domain + "self.parent is null";
		},
		set: function () {
		}
	});

	$scope.getCurrentHome = function () {
		return _params.currentHome;
	}

	$scope.getCurrentParent = function () {
		var base = $scope.currentFolder || $scope.getCurrentHome();
		if (base && base.id > 0) {
			return _.pick(base, "id");
		}
		return base;
	};

	$scope.addRelatedValues = function (record) {
		// apply details about related object
		var base = $scope.currentFolder;
		if (!base || !base.relatedModel) {
			base = $scope.getCurrentHome();
		}
		if (base) {
			record.relatedId = base.relatedId;
			record.relatedModel = base.relatedModel;
		}
		return record;
	};

	$scope.onEdit = function() {
		var rec = getSelected();
		if (rec && rec.typeIcon === "fa fa-folder") {
			return $scope.onFolder(rec);
		}
	};

	$scope.sync = function () {
	}

	function doReload() {
		var fields = _.pluck($scope.fields, 'name');
		var ds = $scope._dataSource;
		var context = $scope.getContext();

		return ds.search({
			fields: _.unique(fields),
			domain: $scope._domain,
			context: context
		});
	};

	$scope.reload = function () {
		var promise = doReload();
		promise.then(function () {
			return $scope.sync();
		});
	}

	$scope.reloadNoSync = function () {
		return doReload();
	};

	function resetFilter() {
		$scope.currentFilter = null;
		$scope._dataSource._filter = null;
		$scope._dataSource._domain = null;
		$scope.$broadcast("on:clear-filter-silent");
	}

	var __filter = $scope.filter;
	$scope.filter = function (searchFilter) {

		var filter = _.extend({}, searchFilter);
		var fields = $scope.fields || {};

		_.each(["relatedId", "relatedModel", "isDirectory", "metaFile.id"], function (name) {
			fields[name] = fields[name] || { name: name };
		});

		var advance = !_.isEmpty(filter.criteria) || !_.isEmpty(filter._domains);
		if (advance) {
			$scope.currentFilter = filter;
			$scope.currentFolder = null;
			$scope.currentPaths.length = 0;
		} else {
			resetFilter();
		}

		filter._domain = $scope._domain;
		filter._context = $scope.getContext();

		return __filter.call($scope, filter);
	};

	$scope.onFolder = function(folder, currentPaths) {

		// reset filter
		resetFilter();

		var paths = currentPaths || $scope.currentPaths || [];
		var index = paths.indexOf(folder);

		if (index > -1) {
			paths = paths.splice(0, index + 1);
		}
		if (folder && index === -1) {
			paths.push(folder);
		}
		if (!folder) {
			paths = [];
		}

		$scope.currentFolder = folder;
		$scope.currentPaths = paths;

		return $scope.reloadNoSync();
	}

	$scope.onItemClick = function(event, args) {
		var elem = $(event.target);
		$scope.$timeout(function () {
			var record = getSelected();
			if (elem.is('.fa-folder')) return $scope.onFolder(record);
			if (elem.is('.fa-download')) return $scope.onDownload(record);
			if (elem.is('.fa-info-circle')) return $scope.onDetails(record);
			if (elem.is('.fa') && record && (record.contentType === "html" || record.contentType === "spreadsheet")) {
				return $scope.onEditFile(record);
			}
		});
	};

	$scope.onItemDblClick = function(event, args) {
		var elem = $(event.target);
		if (elem.hasClass("fa")) return;
		setTimeout(function () {
			var record = getSelected();
			if (record && (record.contentType === "html" || record.contentType === "spreadsheet")) {
				return $scope.onEditFile(record);
			}
			$scope.onEdit();
			$scope.$apply();
		});
	};

	function getSelected() {
		var index = _.first($scope.selection || []);
		return $scope.dataView.getItem(index);
	}

	function onNew(options, callback) {

		if (!$scope.canCreateDocument(true)) {
			return;
		}

		var opts = _.extend({
			name: _t("New Folder"),
			title: _t("Create folder")
		}, options);

		var count = 1;
		var selected = $scope.getSelected() || {};
		var existing = _.pluck((selected.nodes || []), "fileName");

		existing = existing.concat(_.pluck($scope.dataView.getItems(), "fileName"));

		var name = opts.name;
		while(existing.indexOf(name) > -1) {
			name = opts.name + " (" + ++count + ")";
		}

		inputDialog({
			value: name,
			title: opts.title,
			titleOK: _t("Create")
		}, function (value, done) {
			var parent = $scope.getCurrentParent();
			var record = _.extend({}, opts.record, {
				fileName: value
			});
			if (parent && parent.id > 0) {
				record.parent = parent;
			}
			record = $scope.addRelatedValues(record);
			var promise = $scope._dataSource.save(record);
			promise.then(done, done);
			promise.success(function (record) {
				$scope.reloadNoSync();
				callback(record);
			});
		});
	}

	$scope.onNewFolder = function () {
		onNew({
			name: _t("New Folder"),
			title: _t("Create folder"),
			record: {
				isDirectory: true
			}
		}, function (record) {
		});
	};

	$scope.onNewDoc = function () {
		onNew({
			name: _t("New Document"),
			title: _t("Create document"),
			record: {
				isDirectory: false,
				contentType: "html"
			}
		}, function (record) {
			$scope.onEditFile(record);
		});
	};

	$scope.onNewSheet = function () {
		onNew({
			name: _t("New Spreadsheet"),
			title: _t("Create spreadsheet"),
			record: {
				isDirectory: false,
				contentType: "spreadsheet"
			}
		}, function (record) {
			$scope.onEditFile(record);
		});
	};

	$scope.onRename = function () {
		var record = getSelected();
		if (!record || !record.id) {
			return;
		}

		inputDialog({
			value: record.fileName
		}, function(value, done) {
			if (record.fileName !== value) {
				record.fileName = value;
				rename(record, done);
			} else {
				done();
			}
		});

		function rename(record, done) {
			var promise = $scope._dataSource.save(record);
			promise.then(done, done);
			promise.success(function (record) {
				$scope.reload();
			});
		}
	};

	$scope.onMoveFiles = function (files, toFolder) {
		if (_.isEmpty(files)) { return; }
		_.each(files, function (item) {
			if (toFolder && toFolder.id) {
				item.parent = {
					id: toFolder.id
				};
			} else {
				item.parent = null;
			}
			$scope.addRelatedValues(item);
		});

		$scope._dataSource.saveAll(files)
		.success(function (records) {
			$scope.reloadNoSync();
		});
	};

	$scope.onDownload = function () {

		var http = $scope._dataSource._http;
		var records = _.map($scope.selection, function (i) { return $scope.dataView.getItem(i); });
		var ids = _.pluck(_.compact(records), "id");
		if (ids.length === 0) {
			return;
		}

		http.post("ws/dms/download/batch", {
			model: $scope._model,
			records: ids
		})
		.then(function (res) {
			var data = res.data;
			var batchId = data.batchId;
			var batchName = data.batchName;
			if (batchId) {
				$scope.doDownload("ws/dms/download/" + batchId, batchName);
			}
		});
	};

	$scope.onShowRelated = function () {
		var record = getSelected() || {};
		var id = record.relatedId
		var model = record.relatedModel;
		if (id && model) {
			$scope.$root.openTabByName("form::" + model, {
				"mode": "edit",
				"state": id
			});
		}
	};

	$scope.canShowRelated = function () {
		var record = getSelected();
		return record && !!record.relatedId;
	};

	$scope.onShowMembers = function () {

	};

	$scope.canCreateDocument = function (notify) {
		var parent = $scope.currentFolder || $scope.getCurrentHome();
		if (parent && parent.canWrite === false) {
			if (notify) {
				axelor.notify.error(_t("You can't create document here."));
			}
			return false;
		}
		return true;
	}

	$scope.canEditFile = function () {
		var record = getSelected();
		return record && !!record.contentType;
	};

	$scope.onEditFile = function (record) {
		record = record || getSelected();
		var view = {
			action: "$act:dms" + record.id,
			model: $scope._model,
			title: record.contentType === "spreadsheet" ? _t("Spreadsheet") : _t("Document"),
			viewType: "form",
			views: [{
				type: "form",
				width: "large",
				items: [{
					type: "panel",
					items: [{
						type: "button",
						width: "100px",
						title: _t("Save"),
						onClick: "save"
					}, {
						type: "field",
						name: "content",
						showTitle: false,
						widget: record.contentType || "html",
						colSpan: 12,
						height: 520
					}]
				}]
			}],
			recordId: record.id,
			forceEdit: true,
			params: {
				'show-toolbar': false,
			}
		};

		$scope.$root.openTab(view);
		$scope.waitForActions(function () {
			var formScope = view.$viewScope;
			if (formScope) {
				formScope.$on("$destroy", function () {
					if (formScope.record) {
						record.version = formScope.record.version;
					}
				});
			}
		});
	};
}

ui.directive('uiDmsUploader', ['$q', '$http', function ($q, $http) {

	return function (scope, element, attrs) {

		var input = element.find("input.upload-input");

		var dndTimer = null;
		var dndInternal = false;
		var dndDropClass = "dropping";
		var dndDragClass = "dragging";
		var dndEvents = "dragstart,dragend,dragover,dragenter,dragleave,drop".split(",");

		function clearClassName(force) {
			if (dndTimer) {
				clearTimeout(dndTimer);
			}
			if (force) {
				element.removeClass(dndDropClass);
				return;
			}
			dndTimer = setTimeout(function () {
				element.removeClass(dndDropClass);
			}, 100);
		}

		function dragAndDropHandler(e) {

			if (element.is(":hidden")) {
				return;
			}

			switch (e.type) {
			case "dragstart":
			case "dragend":
				dndInternal = e.type === "dragstart";
				break;
			case "dragover":
				onDragOver(e);
				break;
			case "dragenter":
				break;
			case "dragleave":
				clearClassName();
				break;
			case "drop":
				clearClassName();
				onDropFiles(e);
				break;
			}
		}

		function onDragOver(e) {
			if (dndInternal) return;
			clearClassName(true);
			if (element.is(e.target) || element.has(e.target).size()) {
				element.addClass(dndDropClass);
			} else {
				clearClassName();
			}
		}

		function onDropFiles(e) {
			if (dndInternal) return;
			if (element.is(e.target) || element.has(e.target)) {
				doUpload(e.dataTransfer.files);
			}
		}

		dndEvents.forEach(function (name) {
			document.addEventListener(name, dragAndDropHandler);
		});

		scope.$on("$destroy", function() {
			dndEvents.forEach(function (name) {
				document.removeEventListener(name, dragAndDropHandler);
			});
		});

		var uploads = {
			items: [],
			pending: [],
			running: false,
			queue: function (info) {
				info.pending = true;
				info.progress = 0;
				info.transfer = _t("Pending");
				info.abort = function () {
					info.transfer = _t("Cancelled");
					info.pending = false;
				};
				info.retry = function () {
					uploads.queue(info);
					uploads.process();
				};
				if (this.items.indexOf(info) === -1) {
					this.items.push(info);
				}
				if (this.pending.indexOf(info) === -1) {
					this.pending.push(info);
				}
			},
			process: function () {
				if (this.running || this.pending.length === 0) {
					if (_.all(this.items, function (item) { return item.complete; })) {
						this.items.length = 0;
					}
					return;
				}
				this.running = true;
				var info = this.pending.shift();
				while (info && !info.pending) {
					info = this.pending.shift();
				}
				if (!info) {
					this.running = false;
					return;
				}

				var that = this;
				var promise = uploadSingle(info);

				function error(reason) {
					that.running = false;
					info.active = false;
					info.pending = false;
					info.progress = 0;
					info.transfer = reason.message;
					return that.process();
				}

				function success() {
					that.running = false;
					info.active = false;
					info.pending = false;
					info.complete = true;
					info.progress = "100%";
					return that.process();
				}

				return promise.then(success, error);
			}
		};

		// expose uploads
		scope.uploads = uploads;
		scope.onCloseUploadFiles = function() {
			uploads.items.length = 0;
			uploads.pending.length = 0;
		};

		function doUpload(files) {
			if (!scope.canCreateDocument(true)) {
				return;
			}

			var all = files;
			if (files.fileName) {
				files = [files];
			}

			var i, file;
			for (i = 0; i < all.length; i++) {
				file = all[i];
			}
			for (i = 0; i < all.length; i++) {
				var file = all[i];
				var info = {
					file: file
				};
				uploads.queue(info);
			}
			uploads.process();
		}

		function uploadSingle(info) {
			var deferred = $q.defer();
			var promise = deferred.promise;
			var file = info.file;
			var xhr = new XMLHttpRequest();

			function formatSize(done, total) {
				function format(size) {
					if(size > 1000000000) return parseFloat(size/1000000000).toFixed(2) + " GB";
					if(size > 1000000) return parseFloat(size/1000000).toFixed(2) + " MB";
					if(size >= 1000) return parseFloat(size/1000).toFixed(2) + " KB";
					return size + " B";
				}
				return format(done || 0) + "/" + format(total);
			}

			function doClean() {
				return $http({
					method: "DELETE",
					url: "ws/files/upload/" + info.uuid,
					silent: true,
					transformRequest: []
				});
			}

			function onError(reason) {
				function done() {
					deferred.reject({ message: _t("Failed"), failed: true });
				}
				doClean().then(done, done);
			}

			function onCancel(clean) {
				function done() {
					deferred.reject({ message: _t("Cancelled"), cancelled: true });
				}
				return clean ? doClean().then(done, done) : done();
			}

			function onSuccess(meta) {
				var ds = scope._dataSource;
				var parent = scope.getCurrentParent();
				var record = {
					fileName: meta.fileName,
					metaFile: _.pick(meta, "id")
				};
				if (parent && parent.id > 0) {
					record.parent = parent;
				}
				record = scope.addRelatedValues(record);
				ds.save(record).success(function (dmsFile) {
					deferred.resolve(info);
				}).error(onError);
			}

			function onChunk(response) {

				info._start = info._end;
				info._end = Math.min(info._end + info._size, file.size);

				if (response && response.fileId) {
					info.uuid = response.fileId;
				}
				if (response && response.id) {
					return onSuccess(response);
				}

				if (info.loaded) {
					return onError();
				}

				// continue with next chunk
				sendChunk();
				scope.applyLater();
			}

			function sendChunk() {
				xhr.open("POST", "ws/files/upload", true);
		        xhr.overrideMimeType("application/octet-stream");
		        xhr.setRequestHeader("Content-Type", "application/octet-stream");
				xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

				if (info.uuid) {
					xhr.setRequestHeader("X-File-Id", info.uuid);
				}

				xhr.setRequestHeader("X-File-Name", file.name);
				xhr.setRequestHeader("X-File-Type", file.type);
				xhr.setRequestHeader("X-File-Size", file.size);
				xhr.setRequestHeader("X-File-Offset", info._start);

				if (info._end > file.size) {
					info._end = file.size;
				}

				var chunk = file.slice(info._start, info._end);

		        xhr.send(chunk);
			}

			info.uuid = null;
			info._start = 0;
			info._size = 1000 * 1000; // 1MB
			info._end = info._size;

			info.active = true;
			info.transfer = formatSize(0, file.size);
			info.abort = function () {
				xhr.abort();
				onCancel();
			};
			info.retry = function () {
				// put back on queue
				uploads.queue(info);
				uploads.process();
			};

			xhr.upload.addEventListener("progress", function (e) {
				var total = info._start + e.loaded;
				var done = Math.round((total / file.size) * 100);
				info.progress = done > 95 ? "95%" : done + "%";
				info.transfer = formatSize(total, file.size);
				info.loaded = total === file.size;
				scope.applyLater();
			});

			xhr.onreadystatechange = function(e) {
				if (xhr.readyState == 4) {
					switch(xhr.status) {
					case 0:
					case 406:
						onCancel(true);
						break;
					case 200:
						onChunk(xhr.responseText ? angular.fromJson(xhr.responseText) : null);
						break;
					default:
						onError();
					}
					scope.applyLater();
				}
			}

			sendChunk();

			return promise;
		}

		input.change(function() {
			scope.applyLater(function () {
				doUpload(input.get(0).files);
				input.val(null);
			});
		});

		scope.onUpload = function () {
			input.click();
		};

		scope.doDownload = function (url, fileName) {
			var link = document.createElement('a');

			link.onclick = function(e) {
				setTimeout(function () {
					document.body.removeChild(e.target);
				}, 100);
			};

			link.href = url;
			link.download = fileName;
			link.innerHTML = fileName;
			link.style.display = "none";

			document.body.appendChild(link);

			setTimeout(function () {
				link.click();
			}, 300);

			axelor.notify.info(_t("Downloading {0}...", fileName));
		};
	};
}]);

DmsFolderTreeCtrl.$inject = ["$scope", "DataSource"];
function DmsFolderTreeCtrl($scope, DataSource) {

	var ds = DataSource.create("com.axelor.dms.db.DMSFile");

	$scope.folders = {};
	$scope.rootFolders = [];

	function syncFolders(records) {

		var home = $scope.getCurrentHome();
		var folders = {};
		var rootFolders = [];

		_.each(records, function (item) {
			folders[item.id] = item;
			item.nodes = [];
		});
		_.each(records, function (item) {
			var parent = folders[item["parent.id"]];
			if (parent) {
				parent.nodes.push(item);
				item.parent = parent;
			}
		});

		home = home || {
			open: true,
			active: true,
			fileName: _t("Home")
		};

		home.open = true;
		home.nodes = _.filter(folders, function (item) {
			return !item.parent;
		});

		rootFolders = [home];

		// sync with old state
		_.each($scope.folders, function (item, id) {
			var folder = folders[id];
			if (folder) {
				folder.open = item.open;
				folder.active = item.active;
			}
		});
		_.each($scope.rootFolders, function (root, i) {
			var folder = rootFolders[i];
			if (folder) {
				folder.open = root.open;
				folder.active = root.active;
			}
		});

		$scope.folders = folders;
		$scope.rootFolders = rootFolders;
	}

	$scope.getSelected = function () {
		for (var id in $scope.folders) {
			var folder = $scope.folders[id];
			if (folder && folder.active) {
				return folder;
			}
		}
		var home = _.first($scope.rootFolders);
		if (home && home.active) {
			return home;
		}
	};

	function getDomain() {
		var params = $scope._viewParams;
		var domain = params.domain || "";
		var home = $scope.getCurrentHome();
		if (domain) {
			domain = domain + " AND ";
		}
		domain += "self.isDirectory = true";
		if (home && home.id > 0) {
			domain += " AND self.id != " + home.id;
		}
		if (home && home.relatedModel) {
			domain += " AND self.relatedModel = '" + home.relatedModel + "'";
		}
		if (home && home.relatedId) {
			domain += " AND self.relatedId = " + home.relatedId;
		}
		return domain;
	}

	$scope.sync = function () {
		return ds.search({
			fields: ["fileName", "parent.id", "relatedId", "relatedModel"],
			domain: getDomain(),
			limit: -1,
		}).success(syncFolders);
	};

	$scope.showTree = !axelor.device.small;

	$scope.onToggleTree = function () {
		$scope.showTree = !$scope.showTree;
		axelor.$adjustSize();
	};

	$scope.onFolderClick = function (node) {
		if (!node || !node.id || node.home) {
			$scope.onFolder();
			$scope.applyLater();
			return;
		}
		var paths = [];
		var parent = node.parent;
		while (parent) {
			paths.unshift(parent);
			parent = parent.parent;
		}
		$scope.onFolder(node, paths);
		$scope.applyLater();
	};
}

ui.directive("uiDmsFolders", function () {
	return {
		controller: DmsFolderTreeCtrl,
		link: function (scope, element, attrs) {

			scope.onGridInit = _.once(function (grid, instance) {

				grid.onDragInit.subscribe(function (e, dd) {
					e.stopImmediatePropagation();
				});

				grid.onDragStart.subscribe(function (e, dd) {

					var cell = grid.getCellFromEvent(e);
					if (!cell) return;

					dd.row = cell.row;
					var record = grid.getDataItem(dd.row);
					if (!record || !record.id) {
						return;
					}

					e.stopImmediatePropagation();
					dd.mode = "recycle";

					var rows = grid.getSelectedRows();
					if (rows.length === 0 || rows.indexOf(dd.row) === -1) {
						rows = [dd.row];
					}

					grid.setSelectedRows(rows);
					grid.setActiveCell(cell.row, cell.cell);

					dd.rows = rows;
					dd.count = rows.length;
					dd.records = _.map(rows, function (i) {
						return grid.getDataItem(i);
					});

					var text = "<span>" + record.fileName + "</span>";
					if (dd.count > 1) {
						text += " <span class='badge badge-important'>"+ dd.count +"</span>";
					}

					var proxy = $("<div class='grid-dnd-proxy'></div>")
						.hide()
						.html(text)
						.appendTo("body");

					return dd.helper = proxy;
				});

				grid.onDrag.subscribe(function (e, dd) {
					if (dd.mode != "recycle") { return; }
					dd.helper.show().css({top: e.pageY + 5, left: e.pageX + 5});
				});

				grid.onDragEnd.subscribe(function (e, dd) {
					if (dd.mode != "recycle") { return; }
					dd.helper.remove();
				});

				$.drop({
					mode: "intersect"
				});
			});

			scope.$watch("currentFolder", function (folder) {
				var folders = scope.folders || {};
				var rootFolders = scope.rootFolders || [];

				for (var id in folders) {
					folders[id].active = false;
				}

				(rootFolders[0]||{}).active = false;

				var id = (folder||{}).id;
				var node = folders[id] || rootFolders[0];
				if (node) {
					node.active = true;
				}
			});

			function syncHome(record) {
				var home = scope.getCurrentHome();
				if (home && home.id > 0) return;
				if (home && record && record.parent) {
					home.id = record.parent.id;
				}
			}

			scope._dataSource.on("on:save", function (e) {
				syncHome(scope._dataSource.at(0));
				return scope.sync();
			});
			scope._dataSource.on("on:remove", function () {
				return scope.sync();
			});

			scope.sync();
		},
		template: "<ul ui-dms-tree x-handler='this' x-nodes='rootFolders' class='dms-tree'></ul>"
	};
});

ui.directive("uiDmsTreeNode", function () {

	return {
		scope: true,
		link: function (scope, element, attrs) {

			element.children('.highlight').on("dropstart", function (e, dd) {
				var records = dd.records;
				if (!records || records.length === 0) {
					return;
				}
				if (scope.node.active) {
					return;
				}
				for (var i = 0; i < records.length; i++) {
					var record = records[i];
					var current = scope.node;
					while(current) {
						if (record.id === current.id) { return; }
						if (record.parent && record.parent.id === current.id) { return; }
						current = current.parent;
					}
				}
				element.addClass("dropping");
			});

			element.children('.highlight').on("dropend", function (e, dd) {
				element.removeClass("dropping");
			});

			element.children('.highlight').on("drop", function (e, dd) {
				var records = dd.records;
				if (!records || records.length === 0 || !scope.node) {
					return;
				}
				if (!element.hasClass("dropping")) {
					return;
				}
				scope.onMoveFiles(records, scope.node);
			});
		},
		replace: true,
		template: "" +
		"<a href='javascript:' ng-click='onClick($event, node)' ng-class='{active: node.active}'>" +
			"<span class='highlight'></span>" +
			"<i class='fa fa-caret-down handle' ng-show='node.open'></i> " +
			"<i class='fa fa-caret-right handle' ng-show='!node.open'></i> " +
			"<i class='fa fa-folder'></i> " +
			"<span class='title'>{{node.fileName}}</span>" +
		"</a>"
	};
});

ui.directive("uiDmsTree", ['$compile', function ($compile) {

	var template = "" +
	"<li ng-repeat='node in nodes' ng-class='{empty: !node.nodes.length}' class='dms-tree-folder'>" +
		"<a x-node='node' ui-dms-tree-node></a>" +
		"<ul ng-show='node.open' x-handler='handler' x-nodes='node.nodes' ui-dms-tree></ul>" +
	"</li>";

	return {
		scope: {
			nodes: "=",
			handler: "="
		},
		link: function (scope, element, attrs) {
			var handler = scope.handler;

			scope.onClick = function (e, node) {
				if ($(e.target).is("i.handle")) {
					return node.open = !node.open;
				}
				return handler.onFolderClick(node);
			};

			scope.onMoveFiles = function (files, toFolder) {
				return handler.onMoveFiles(files, toFolder);
			}

			$compile(template)(scope).appendTo(element);
		}
	};
}]);

ui.directive("uiDmsDetails", function () {

	return {
		controller: ["$scope", function ($scope) {

			function set(record) {
				var info = $scope.details = {};
				if (record) {
					info.id = record.id;
					info.version = record.version;
					info.name = record.fileName;
					info.type = record.fileType || _t("Unknown");
					info.tags = record.tags;
					info.owner = (record.createdBy||{}).name;
					info.created = moment(record.createdOn).format('DD/MM/YYYY HH:mm');
					info.updated = moment(record.lastModifiedOn).format('DD/MM/YYYY HH:mm');
				}
			}

			$scope.tagsFormName = "dms-file-tags-form";
			$scope.showDetails = false;
			$scope.showTagEditor = false;

			$scope.onDetails = function (record) {
				$scope.showDetails = true;
				axelor.$adjustSize();
				set(record);
			};

			$scope.onCloseDetails = function () {
				$scope.showDetails = false;
				$scope.showTagEditor = false;
				axelor.$adjustSize();
			};

			$scope.onAddTags = function () {
				$scope.showTagEditor = true;
			};

			$scope.onSaveTags = function () {
				var ds = $scope._dataSource;
				function doClose(rec) {
					$scope.showTagEditor = false;
					$scope.details.tags = rec.tags;
					$scope.details.version = rec.version;
				}
				var record = _.pick($scope.details, "id", "version", "tags");
				ds.save(record).success(doClose);
			};

			$scope.$watch("selection[0]", function (index) {
				if (index === undefined || !$scope.showDetails) return;
				var details = $scope.details || {};
				var record = $scope.dataView.getItem(index) || {};
				if (details.id !== record.id) {
					$scope.onCloseDetails();
				}
			});
		}],
		link: function (scope, element, attrs) {

		}
	}
});

// members popup
ui.directive("uiDmsMembersPopup", ["$compile", function ($compile) {
	return {
		link: function (scope, element, attrs) {

			var form = null;

			scope.permissionFormName = "dms-file-permission-form";
			scope.permissionFormTitle = _t("Permissions");

			scope.canShare = function () {
				if (!scope.selection || scope.selection.length === 0) return false;
				var selected = _.first(scope.selection);
				var record = scope.dataView.getItem(selected);
				return record && record.canShare;
			};

			scope.onPermissions = function () {

				if (form === null) {
					form = $("<div ui-dms-inline-form></div>")
						.attr("x-record", "record")
						.attr("x-form-name", "permissionFormName")
						.attr("x-form-title", "permissionFormTitle");
					form = $compile(form)(scope);
					form.appendTo(element);
					form.width("100%");
				}

				var selected = _.first(scope.selection);
				var record = scope.dataView.getItem(selected);

				var formScope = form.isolateScope();

				formScope.doRead(record.id).success(function (rec) {
					formScope.edit(rec);
					setTimeout(function () {
						element.dialog("option", "height", 320);
						element.dialog("open");
					});
				});
			};

			scope.onSavePermissions = function () {

				var ds = scope._dataSource._new("com.axelor.dms.db.DMSPermission");
				var formScope = form.isolateScope();

				if (!formScope.isValid()) {
					return axelor.notify.error(_t("Invalid permissions"));
				}

				var record = formScope.record;
				var original = formScope.$$original.permissions || [];

				var toSave = _.map(record.permissions, function (item) {
					item.file = _.pick(record, "id");
					return item;
				});

				var toRemove = _.filter(original, function (item) {
					return !_.findWhere(toSave, { id: item.id });
				});

				function doClose() {
					element.dialog("close");
					formScope.edit(null);
				}

				var promise = null;
				if (toRemove.length) {
					promise = ds._request('removeAll').post({
						records: toRemove
					});
				}
				if (toSave.length) {
					promise = promise ? promise.then(function () {
						return ds.saveAll(toSave);
					}) : ds.saveAll(toSave);
				}

				if (promise) {
					promise.then(doClose);
				} else {
					doClose();
				}
			};

			scope.$on("$destroy", function () {
				if (form) {
					form.isolateScope().$destroy();
					form = null;
				}
			});
		},
		replace: true,
		template:
			"<div ui-dialog x-on-ok='onSavePermissions' x-css='ui-dialog-small dms-permission-popup' title='Permissions'></div>"
	};
}]);

ui.directive("uiDmsInlineForm", function () {
	return {
		scope: {
			formName: "=",
			formTitle: "=",
			record: "="
		},
		controller: ["$scope", "$element", 'DataSource', 'ViewService', function($scope, $element, DataSource, ViewService) {
			$scope._viewParams = {
				action: _.uniqueId('$act'),
				title: $scope.formTitle,
				model: "com.axelor.dms.db.DMSFile",
				viewType: "form",
				views: [{
					type: "form",
					name: $scope.formName
				}]
			};
			ViewCtrl.call(this, $scope, DataSource, ViewService);
			FormViewCtrl.call(this, $scope, $element);

			$scope.setEditable();
			$scope.onHotKey = function (e) {
				e.preventDefault();
				return false;
			};
		}],
		link: function (scope, element, attrs) {

		},
		template: "<div ui-view-form x-handler='true'></div>"
	};
});

// attachment popup
ui.directive("uiDmsPopup", ['$compile', function ($compile) {

	return {
		scope: {
			onSelect: "&"
		},
		controller: ["$scope", 'DataSource', 'ViewService', 'NavService', function($scope, DataSource, ViewService, NavService) {

			$scope._isPopup = true;
			$scope._viewParams = {
				action: _.uniqueId('$act'),
				model: "com.axelor.dms.db.DMSFile",
				viewType: "grid",
				views: [{
					type: "grid",
					name: "dms-file-grid"
				}]
			};

			ViewCtrl.apply(this, arguments);

			var ds = DataSource.create("com.axelor.dms.db.DMSFile");

			$scope.findHome = function (forScope, success) {

				var home = {};
				var record = forScope.record;

				function objectName() {
					return _.humanize(_.last(forScope._model.split(".")));
				}

				function findName() {
					for (var name in forScope.fields) {
						if (forScope.fields[name].nameColumn) {
							return record[name];
						}
					}
					return record.name || _.lpad(record.id, 5, '0');
				}

				var domain = "self.isDirectory = true AND self.relatedId = :rid AND self.relatedModel = :rmodel";

				domain = "" +
						"self.isDirectory = true AND " +
						"self.relatedId = :rid AND " +
						"self.relatedModel = :rmodel AND " +
						"self.parent.relatedModel = :rmodel AND " +
						"(self.parent.relatedId is null OR self.parent.relatedId = 0)";

				var context = {
					"rid": record.id,
					"rmodel": forScope._model
				};

				function process(home) {
					if (!home) {
						home = {};
						home.id = -1;
						home.fileName = findName();
						home.relatedModel = forScope._model;
						home.relatedId = record.id;
					}
					home.home = true;
					home.open = true;
					home.active = true;
					return home;
				}

				ds.search({
					limit: 1,
					fields: ['fileName', 'relatedModel', 'relatedId'],
					domain: domain,
					context: context
				}).success(function (records) {
					success(process(_.first(records)));
				});
			};

			$scope.countAttachments = function (forScope, done) {
				var ds = DataSource.create("com.axelor.meta.db.MetaAttachment");
				var record = forScope.record;
				var domain = "self.objectName = :name AND self.objectId = :id";
				var context = {name: forScope._model, id: record.id };
				var promise = ds.search({
					fields: ['id'],
					domain: domain,
					context: context
				});

				promise.success(function (records) {
					record.$attachments = _.size(records);
				});

				return promise.then(done, done);
			};

			if ($scope.onSelect()) {
				$scope.buttons = [{
					text: _t("Select"),
					'class': 'btn btn-primary',
					click: function (e) {
						var viewScope = $(this).find(".grid-view").scope();
						var items = _.map(viewScope.selection, function (i) {
							return viewScope.dataView.getItem(i);
						});
						$scope._onSelectFiles(items);
					}
				}];
			}
		}],
		link: function (scope, element, attrs) {

			scope._onSelectFiles = function (items) {
				scope.applyLater(function () {
					var promise = scope.onSelect()(items);
					if (promise && promise.then) {
						promise.then(function () {
							element.dialog("close");
						});
					} else {
						element.dialog("close");
					}
				});
			}

			setTimeout(function () {
				var elemDialog = element.parent();
				var elemTitle = elemDialog.find('.ui-dialog-title');
				$('<a href="#" class="ui-dialog-titlebar-max"><i class="fa fa-expand"></i></a>').click(function (e) {
					$(this).children('i').toggleClass('fa-expand fa-compress');
					elemDialog.toggleClass('maximized');
					axelor.$adjustSize();
					return false;
				}).insertAfter(elemTitle);

				var height = $(window).height();
				height = Math.min(480, height);
				element.dialog('option', 'height', height);
			});

			scope.onHotKey = function (e, action) {
				var elem = element.find(".grid-view:first");
				var viewScope = elem.scope();
				if (viewScope && viewScope.onHotKey) {
					return viewScope.onHotKey(e, action);
				}
			};

			var formScope = null;

			scope.onClose = function () {
				if (formScope) {
					scope.countAttachments(formScope, function () {
						scope.$destroy();
					});
				} else {
					scope.$destroy();
				}
				formScope = null;
			};

			scope.showPopup = function (forScope) {

				formScope = forScope;

				function doOpen() {
					var content = "<div ng-include='\"partials/views/dms-file-list.html\"'></div>";
					content = $compile(content)(scope);
					content.appendTo(element);
					setTimeout(function () {
						element.dialog("open");
					});
				}

				if (!formScope) {
					return doOpen();
				}

				scope.findHome(forScope, function (home) {
					scope._viewParams.currentHome = home;
					doOpen();
				});
			};

		},
		replace: true,
		template: "<div ui-dialog x-buttons='buttons' x-on-ok='false' x-on-close='onClose' class='dms-popup' title='Attachments'></div>"
	};
}]);

// prevent download on droping files
$(function () {
	window.addEventListener("dragover",function(e) {
		e.preventDefault();
	}, false);

	window.addEventListener("drop",function(e) {
		e.preventDefault();
	}, false);
});

}).call(this);
