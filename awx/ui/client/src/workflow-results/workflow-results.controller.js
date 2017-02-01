export default ['workflowData',
    'workflowResultsService',
    'workflowDataOptions',
    'jobLabels',
    'workflowNodes',
    '$scope',
    'ParseTypeChange',
    'ParseVariableString',
    'WorkflowService',
    'count',
    '$state',
    'i18n',
    function(workflowData,
        workflowResultsService,
        workflowDataOptions,
        jobLabels,
        workflowNodes,
        $scope,
        ParseTypeChange,
        ParseVariableString,
        WorkflowService,
        count,
        $state,
        i18n
    ) {

        var getTowerLinks = function() {
            var getTowerLink = function(key) {
                if(key === 'schedule') {
                    if($scope.workflow.related.schedule) {
                        return '/#/templates/workflow_job_template/' + $scope.workflow.workflow_job_template + '/schedules' + $scope.workflow.related.schedule.split('api/v1/schedules')[1];
                    }
                    else {
                        return null;
                    }
                }
                else {
                    if ($scope.workflow.related[key]) {
                        return '/#/' + $scope.workflow.related[key]
                            .split('api/v1/')[1];
                    } else {
                        return null;
                    }
                }
            };

            $scope.workflow_template_link = '/#/templates/workflow_job_template/'+$scope.workflow.workflow_job_template;
            $scope.created_by_link = getTowerLink('created_by');
            $scope.scheduled_by_link = getTowerLink('schedule');console.log($scope.scheduled_by_link);
            $scope.cloud_credential_link = getTowerLink('cloud_credential');
            $scope.network_credential_link = getTowerLink('network_credential');
        };

        var getTowerLabels = function() {
            var getTowerLabel = function(key) {
                if ($scope.workflowOptions && $scope.workflowOptions[key]) {
                    return $scope.workflowOptions[key].choices
                        .filter(val => val[0] === $scope.workflow[key])
                        .map(val => val[1])[0];
                } else {
                    return null;
                }
            };

            $scope.status_label = getTowerLabel('status');
            $scope.type_label = getTowerLabel('job_type');
            $scope.verbosity_label = getTowerLabel('verbosity');
        };

        function init() {
            // put initially resolved request data on scope
            $scope.workflow = workflowData;
            $scope.workflow_nodes = workflowNodes;
            $scope.workflowOptions = workflowDataOptions.actions.GET;
            $scope.labels = jobLabels;
            $scope.count = count.val;
            $scope.showManualControls = false;

            // stdout full screen toggle tooltip text
            $scope.toggleStdoutFullscreenTooltip = i18n._("Expand Output");

            // turn related api browser routes into tower routes
            getTowerLinks();

            // use options labels to manipulate display of details
            getTowerLabels();

            // set up a read only code mirror for extra vars
            $scope.variables = ParseVariableString($scope.workflow.extra_vars);
            $scope.parseType = 'yaml';
            ParseTypeChange({ scope: $scope,
                field_id: 'pre-formatted-variables',
                readOnly: true });

            // Click binding for the expand/collapse button on the standard out log
            $scope.stdoutFullScreen = false;

            WorkflowService.buildTree({
                workflowNodes: workflowNodes
            }).then(function(data){
                $scope.treeData = data;

                // TODO: I think that the workflow chart directive (and eventually d3) is meddling with
                // this treeData object and removing the children object for some reason (?)
                // This happens on occasion and I think is a race condition (?)
                if(!$scope.treeData.data.children) {
                    $scope.treeData.data.children = [];
                }

                $scope.canAddWorkflowJobTemplate = false;
            });

        }

        $scope.toggleStdoutFullscreen = function() {
            $scope.stdoutFullScreen = !$scope.stdoutFullScreen;

            if ($scope.stdoutFullScreen === true) {
                $scope.toggleStdoutFullscreenTooltip = i18n._("Collapse Output");
            } else if ($scope.stdoutFullScreen === false) {
                $scope.toggleStdoutFullscreenTooltip = i18n._("Expand Output");
            }
        };

        $scope.deleteJob = function() {
            workflowResultsService.deleteJob($scope.workflow);
        };

        $scope.cancelJob = function() {
            workflowResultsService.cancelJob($scope.workflow);
        };

        $scope.relaunchJob = function() {
            workflowResultsService.relaunchJob($scope);
        };

        $scope.toggleManualControls = function() {
            $scope.showManualControls = !$scope.showManualControls;
        };

        $scope.lessLabels = false;
        $scope.toggleLessLabels = function() {
            if (!$scope.lessLabels) {
                $('#workflow-results-labels').slideUp(200);
                $scope.lessLabels = true;
            }
            else {
                $('#workflow-results-labels').slideDown(200);
                $scope.lessLabels = false;
            }
        };

        $scope.panChart = function(direction) {
            $scope.$broadcast('panWorkflowChart', {
                direction: direction
            });
        };

        $scope.zoomChart = function(zoom) {
            $scope.$broadcast('zoomWorkflowChart', {
                zoom: zoom
            });
        };

        $scope.resetChart = function() {
            $scope.$broadcast('resetWorkflowChart');
        };

        $scope.workflowZoomed = function(zoom) {
            $scope.$broadcast('workflowZoomed', {
                zoom: zoom
            });
        };

        init();

        // Processing of job-status messages from the websocket
        $scope.$on(`ws-jobs`, function(e, data) {
            // Update the workflow job's unified job:
            if (parseInt(data.unified_job_id, 10) === parseInt($scope.workflow.id,10)) {
                    $scope.workflow.status = data.status;

                    if(data.status === "successful" || data.status === "failed"){
                        $state.go('.', null, { reload: true });
                    }
            }
            // Update the jobs spawned by the workflow:
            if(data.hasOwnProperty('workflow_job_id') &&
                parseInt(data.workflow_job_id, 10) === parseInt($scope.workflow.id,10)){

                    WorkflowService.updateStatusOfNode({
                        treeData: $scope.treeData,
                        nodeId: data.workflow_node_id,
                        status: data.status,
                        unified_job_id: data.unified_job_id
                    });

                    $scope.workflow_nodes.forEach(node => {
                        if(parseInt(node.id) === parseInt(data.workflow_node_id)){
                            node.summary_fields.job = {
                                    status: data.status
                            };
                        }
                    });

                    $scope.count = workflowResultsService
                        .getCounts($scope.workflow_nodes);
                    $scope.$broadcast("refreshWorkflowChart");
            }
        });
}];
